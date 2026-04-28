// js/createProduct.js

import { SERVER_URL_PROD } from './config.js';

// Hàm gọi API tạo sản phẩm
export async function createDataProduct({ uid, name, type, price, images, linkproduct }) {
  const response = await fetch(`${SERVER_URL_PROD}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, name, type, price, images, linkproduct })
  });
  return await response.json();
}

// Hàm chuyển file sang base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

//------------------ UPload ảnh và audio lên R2 ------------------

// Upload ảnh base64 lên R2
export async function uploadImageToR2(base64, prefix = '') {
  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }
  const file = dataURLtoFile(base64, 'upload.png');
  const formData = new FormData();
  formData.append('file', file);

  if (prefix) {
    formData.append('prefix', prefix);
  }

  const res = await fetch(`${SERVER_URL_PROD}/api/r2/upload`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.success && data.data && data.data.url) {
    return data.data.url;
  }
  throw new Error('Upload ảnh lên R2 thất bại');
}

// Upload audio base64 lên R2
export async function uploadAudioToR2(base64, prefix = '') {
  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }
  
  const file = dataURLtoFile(base64, 'upload.mp3');
  const formData = new FormData();
  formData.append('audio', file);

  if (prefix) {
    formData.append('prefix', prefix);
  }

  const res = await fetch(`${SERVER_URL_PROD}/api/r2/upload-audio`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.success && data.data && data.data.url) {
    return data.data.url;
  }
  throw new Error('Upload audio lên R2 thất bại');
}