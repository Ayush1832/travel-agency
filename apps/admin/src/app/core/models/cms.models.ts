export interface CmsPage {
  _id: string;
  title: string;
  slug: string;
  body: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CmsBanner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  altText?: string;
  sortOrder: number;
  isActive: boolean;
  scheduledFrom?: string;
  scheduledTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  _id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  updatedAt: string;
}
