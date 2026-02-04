// Mock templates data matching TokiToki
// Using local template images from public/templates folder

export interface Template {
  id: string;
  name: string;
  price: number;
  thumbnail: string;
}

const getTemplateThumbnail = (templateId: string): string => {
  // Images are stored in backend/public/templates folder
  // Backend serves them at http://localhost:3001/templates/
  // Map template IDs to actual filenames (all images are .jpg)
  const filenameMap: Record<string, string> = {
    'echoheart': 'echoheart',
    'heartmosaic': 'echoheart', // May need to add this image
    'stellarbloom': 'stellarbloom', // May need to add this image
    'loveletter': 'loveletter', // May need to add this image
    'chillroom': 'chillroom',
    'lovehex': 'lovehex',
    'letterinspace': 'space', // Maps to space.jpg
    'dearsky': 'dearsky',
    'gacha': 'gacha',
    'captured': 'capturedmoments', // Maps to capturedmoments.jpg
    'puzzlelove': 'puzzlelove',
    'photoalbum': 'photoalbum',
    'message': 'message',
    'lanternia': 'lanternia',
    'lovecount': 'lovecount',
    'crystalrose': 'crystalrose',
    'snowheart': 'snowheart',
    'christmastree': 'christmastree',
    'birthdaycake': 'birthdaycake',
    'binarylove': 'binarylove', // Additional template
  };
  
  const filename = filenameMap[templateId] || templateId;
  // Use Vite proxy instead of direct backend URL to avoid CORS issues
  return `/backend-templates/${filename}.jpg`;
};

export const mockTemplates: Template[] = [
  { id: 'echoheart', name: 'Echo of Heart', price: 49000, thumbnail: getTemplateThumbnail('echoheart') },
  { id: 'heartmosaic', name: 'Heart Mosaic', price: 49000, thumbnail: getTemplateThumbnail('heartmosaic') },
  { id: 'stellarbloom', name: 'Stellar Bloom', price: 49000, thumbnail: getTemplateThumbnail('stellarbloom') },
  { id: 'loveletter', name: 'Love Letter', price: 49000, thumbnail: getTemplateThumbnail('loveletter') },
  { id: 'chillroom', name: 'Chill Room', price: 49000, thumbnail: getTemplateThumbnail('chillroom') },
  { id: 'lovehex', name: 'Love Hex', price: 49000, thumbnail: getTemplateThumbnail('lovehex') },
  { id: 'letterinspace', name: 'Letter In Space', price: 49000, thumbnail: getTemplateThumbnail('letterinspace') },
  { id: 'dearsky', name: 'Dear Sky', price: 49000, thumbnail: getTemplateThumbnail('dearsky') },
  { id: 'gacha', name: 'Gacha Machine', price: 39000, thumbnail: getTemplateThumbnail('gacha') },
  { id: 'captured', name: 'Captured Moments', price: 39000, thumbnail: getTemplateThumbnail('captured') },
  { id: 'puzzlelove', name: 'Puzzle Love', price: 49000, thumbnail: getTemplateThumbnail('puzzlelove') },
  { id: 'photoalbum', name: 'Photo Album', price: 149000, thumbnail: getTemplateThumbnail('photoalbum') },
  { id: 'message', name: 'Message', price: 49000, thumbnail: getTemplateThumbnail('message') },
  { id: 'lanternia', name: 'Lanternia', price: 49000, thumbnail: getTemplateThumbnail('lanternia') },
  { id: 'lovecount', name: 'Love Count', price: 49000, thumbnail: getTemplateThumbnail('lovecount') },
  { id: 'crystalrose', name: 'Crystal Rose', price: 49000, thumbnail: getTemplateThumbnail('crystalrose') },
  { id: 'snowheart', name: 'Snow Heart', price: 49000, thumbnail: getTemplateThumbnail('snowheart') },
  { id: 'christmastree', name: 'Christmas Tree', price: 49000, thumbnail: getTemplateThumbnail('christmastree') },
  { id: 'birthdaycake', name: 'Happy Birthday Cake', price: 49000, thumbnail: getTemplateThumbnail('birthdaycake') },
];

