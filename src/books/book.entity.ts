export interface Book {
  id: string;
  title: string;
  author: string;
  year?: number;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
