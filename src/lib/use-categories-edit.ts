// Category changes from screens: run the change, refresh lists, and explain a refusal in a dialog.
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { createCategory, useCategories } from './data';
import { notify } from './dialogs';
import { useLocale } from './i18n';
import { errorText } from './supabase';

export function useCategoryEdit() {
  const { t } = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const cats = useCategories().data ?? [];
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['categories'] }), qc.invalidateQueries({ queryKey: ['plants'] })]);
  /** Run a change; false (after a dialog) when it failed. */
  const run = async (work: () => Promise<unknown>, failTitle = t('저장하지 못했습니다', 'Could not save', '保存できませんでした')) => {
    try {
      await work();
      await refresh();
      return true;
    } catch (e) {
      notify(failTitle, errorText(e));
      return false;
    }
  };
  /** New category under `parentId` (null = 대분류); its id, or null when refused. */
  const create = async (name: string, parentId: string | null) => {
    if (!user) return null;
    let id: string | null = null;
    const ok = await run(async () => {
      id = await createCategory(user.id, name, parentId, cats, t);
    });
    return ok ? id : null;
  };
  return { cats, run, create, refresh };
}
