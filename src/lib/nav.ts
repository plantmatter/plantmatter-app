// Navigation helpers shared by screens (kept out of src/app so they are not routes).
import { router } from 'expo-router';

/** New plant; from a category page the category is picked already. */
export const addPlant = (categoryId?: string | null) => router.push(categoryId ? `/plants/edit?category=${encodeURIComponent(categoryId)}` : '/plants/edit');
/** One My Plants page: 'all', 'unsorted' or a category id. */
export const openCollection = (key: string) => router.push(`/plant/collection/${encodeURIComponent(key)}`);
