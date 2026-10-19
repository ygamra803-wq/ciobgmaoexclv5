import { normalizeSearchString, multiTokenSearch, fuzzyMatch } from '../../utils/searchUtils';

/**
 * خدمة البحث السريع المفهرس (Indexed In-Memory Search Service)
 * @module SearchService
 */
export class SearchService {
  static #indexes = new Map();

  /**
   * إنشاء أو تحديث الفهرس لمجموعة بيانات
   * @param {string} indexName - اسم الفهرس (مثلاً 'stock', 'machines')
   * @param {Array} data - مصفوفة البيانات
   * @param {string[]} fields - الحقول المراد فهرستها
   */
  static buildIndex(indexName, data = [], fields = []) {
    const searchMap = new Map();

    data.forEach((item, index) => {
      const combinedTokens = fields
        .map(field => normalizeSearchString(item[field]))
        .join(' ');

      searchMap.set(index, {
        item,
        text: combinedTokens
      });
    });

    this.#indexes.set(indexName, {
      searchMap,
      data,
      fields
    });
  }

  /**
   * البحث السريع باستخدام الفهرس
   * @param {string} indexName
   * @param {string} query
   * @returns {Array}
   */
  static search(indexName, query) {
    if (!query || !query.trim()) {
      return this.#indexes.get(indexName)?.data || [];
    }

    const indexObj = this.#indexes.get(indexName);
    if (!indexObj) return [];

    const normQuery = normalizeSearchString(query);
    const tokens = normQuery.split(/\s+/).filter(Boolean);

    const results = [];
    for (const [, entry] of indexObj.searchMap.entries()) {
      const match = tokens.every(token => entry.text.includes(token));
      if (match) {
        results.push(entry.item);
      }
    }

    return results;
  }

  /**
   * مسح فهرس معين أو كل الفهارس
   */
  static clearIndex(indexName = null) {
    if (indexName) {
      this.#indexes.delete(indexName);
    } else {
      this.#indexes.clear();
    }
  }
}

export { normalizeSearchString, multiTokenSearch, fuzzyMatch };
export default SearchService;
