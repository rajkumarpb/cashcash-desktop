import { Service } from 'typedi';
import { getManager, EntityManager } from 'typeorm';

import { RuleParameters } from './dto/Parameters';
import Page from './dto/Page';
import CashFilter from '../database/entity/CashFilter';
import CashFilterRepository from '../database/repository/CashFilterRepository';
import CashTagRepository from '../database/repository/CashTagRepository';
import StringUtils from '../utils/StringUtils';
import { FieldNameDetectionType } from '../database/entity/proxy/CashRuleV1';

@Service()
export default class CashFilterService {
    async get(id: string): Promise<CashFilter | undefined> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        const item = await repo.findOne(id, {
            relations: ['cashAccountList', 'cashRuleList', 'cashRuleList.action'],
        });
        if (
            item &&
            item.jsonFilter.list.some((item) => item.fieldName === FieldNameDetectionType.TAG)
        ) {
            const tagRepo = getManager().getCustomRepository(CashTagRepository);
            const existingTagIdList = (await tagRepo.find()).map((item) => item.id);
            const cleanedUpList = item.jsonFilter.list.filter((item) => {
                if (item.fieldName !== FieldNameDetectionType.TAG) {
                    return true;
                }
                return existingTagIdList.includes(+item.parameter);
            });
            item.jsonFilter.list = cleanedUpList;
        }
        return item;
    }

    async getPage(
        currentPage: number = 1,
        parameters: RuleParameters = {},
        itemPerPage: number = 15,
    ): Promise<Page<CashFilter>> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.findCustom(currentPage, itemPerPage, parameters);
    }

    async getList(): Promise<CashFilter[]> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.find();
    }

    async getListWithoutRule(): Promise<CashFilter[]> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.findListWithoutRule();
    }

    async getListByParam(parameters: RuleParameters = {}): Promise<CashFilter[]> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.findListCustom(parameters);
    }

    async countForThisAccountId(accountId: string): Promise<number> {
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.countForThisAccountId(accountId);
    }

    async save(item: CashFilter) {
        this.sanitize(item);
        const repo = getManager().getCustomRepository(CashFilterRepository);
        return await repo.save(item);
    }

    async duplicate(id: string): Promise<CashFilter | undefined> {
        const item = await this.get(id);
        if (item) {
            return new CashFilter({
                name: StringUtils.generateDuplicateName(item.name),
                jsonFilter: item.jsonFilter,
            });
        }
        return;
    }

    async delete(id: string) {
        return await getManager().transaction(async (entityManager: EntityManager) => {
            const item: CashFilter | undefined = await this.get(id)!;
            if (item) {
                for (const rule of await item.cashRuleList) {
                    await entityManager.remove(rule);
                    await entityManager.remove(rule.action);
                }
                await entityManager.remove(item);
            }
        });
    }

    async deleteList(idList: string[]) {
        for (const id of idList) {
            await this.delete(id);
        }
    }

    private sanitize(item: CashFilter) {
        if (item.name) {
            item.name = item.name.trim();
        }
    }
}
