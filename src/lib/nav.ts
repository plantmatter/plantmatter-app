// Navigation helpers shared by screens (kept out of src/app so they are not routes).
import { router } from 'expo-router';

export const addPlant = (genus?: string) => router.push(genus ? `/plants/edit?genus=${encodeURIComponent(genus)}` : '/plants/edit');
/** One My Plants collection: 'all', 'unsorted' or a genus category id. */
export const openCollection = (key: string) => router.push(`/plant/collection/${encodeURIComponent(key)}`);
