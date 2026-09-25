export interface StoredAccessCode {
  code: string;
  reference: string;
  productId: string;
  storedAt: number;
  productTitle?: string;
}

export const accessCodeStorage = {
  save: (code: string, reference: string, productId: string, title?: string) => {
    try {
      const entry: StoredAccessCode = {
        code: code.toUpperCase(),
        reference,
        productId,
        storedAt: Date.now(),
        productTitle: title,
      };
      localStorage.setItem(`avant_code_${code.toUpperCase()}`, JSON.stringify(entry));
      const all = accessCodeStorage.getAll();
      all.push(entry);
      localStorage.setItem('avant_codes_list', JSON.stringify(all));
      return true;
    } catch (e) {
      console.warn('Storage failed:', e);
      return false;
    }
  },

  getAll: () => {
    try {
      const stored = localStorage.getItem('avant_codes_list');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  getByCode: (code: string): StoredAccessCode | null => {
    try {
      const stored = localStorage.getItem(`avant_code_${code.toUpperCase()}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  remove: (code: string) => {
    try {
      localStorage.removeItem(`avant_code_${code.toUpperCase()}`);
      const codes = accessCodeStorage.getAll().filter(c => c.code !== code.toUpperCase());
      localStorage.setItem('avant_codes_list', JSON.stringify(codes));
    } catch (e) {
      console.warn('Remove failed:', e);
    }
  },
};
