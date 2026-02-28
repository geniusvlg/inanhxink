export interface Template {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  template_type: string;
  price: number;
  is_active: boolean;
}
