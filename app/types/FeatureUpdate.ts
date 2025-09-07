export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  date: string;
  timestamp: number; // Unix timestamp in milliseconds for versioning
  images?: string[];
}
