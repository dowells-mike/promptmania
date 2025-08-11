export type BoxCategory = 'default' | 'subject' | 'style' | 'background' | 'composition' | 'angle' | 'reference';
export type BoxType = 'text' | 'image';

export interface BaseBox {
  id: string;
  type: BoxType;
  category: BoxCategory;
  position: number; // ordering index
  created: number;
  modified: number;
}

export interface TextBox extends BaseBox {
  type: 'text';
  content: string; // plaintext version
  richText?: string; // serialized HTML / markdown for now
  weight: number; // 0-5 step .1
  tags: string[]; // NEW: tags applied to this text box
}

export interface ImageBox extends BaseBox {
  type: 'image';
  content: string; // data URL base64
  filename?: string;
  description?: string;
  tags: string[]; // NEW: tags applied to this image reference
}

export type AnyBox = TextBox | ImageBox;

export function isTextBox(b: AnyBox): b is TextBox { return b.type === 'text'; }
export function isImageBox(b: AnyBox): b is ImageBox { return b.type === 'image'; }

export interface Project {
  id: string;
  name: string;
  created: number;
  modified: number;
  tags: string[];
  boxes: AnyBox[];
  version: 1;
}

export type PlatformPreset = 'midjourney' | 'stable-diffusion' | 'dalle' | 'plain';

export const BOX_CATEGORIES: BoxCategory[] = ['default','subject','style','background','composition','angle','reference'];
export function isBoxCategory(v: any): v is BoxCategory { return BOX_CATEGORIES.includes(v); }
