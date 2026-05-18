import { BASE_URL } from '@/constants/api';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

type UploadProfilePhotoParams = {
  phoneNumber: string;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  useAuth?: boolean;
};

type UploadProfilePhotoResponse = {
  photoUrl: string;
};

function buildPhotoFormData(uri: string, mimeType?: string | null, fileName?: string | null) {
  const formData = new FormData();
  let name = fileName ?? uri.split('/').pop() ?? 'photo.jpg';
  if (!name.includes('.')) {
    name = `${name}.jpg`;
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const type = mimeType ?? (extension === 'png' ? 'image/png' : 'image/jpeg');

  formData.append('photo', {
    uri,
    type,
    name,
  } as unknown as Blob);

  return formData;
}

export async function uploadProfilePhoto({
  phoneNumber,
  uri,
  mimeType,
  fileName,
  useAuth = true,
}: UploadProfilePhotoParams): Promise<UploadProfilePhotoResponse> {
  const trimmedPhone = phoneNumber.trim();
  if (!trimmedPhone) {
    throw new Error('Не знайдено номер телефону для завантаження фото');
  }

  const url = `${BASE_URL}/users/by-phone/photo?phoneNumber=${encodeURIComponent(trimmedPhone)}`;
  const body = buildPhotoFormData(uri, mimeType, fileName);

  const response = useAuth
    ? await fetchWithAuth(url, { method: 'POST', body })
    : await fetch(url, {
        method: 'POST',
        body,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Помилка завантаження фото';
    throw new Error(message);
  }

  const photoUrl = typeof data?.photoUrl === 'string' ? data.photoUrl : null;
  if (!photoUrl) {
    throw new Error('Сервер не повернув шлях до фото');
  }

  const verify = await fetch(`${BASE_URL}${photoUrl}`, {
    method: 'HEAD',
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (!verify.ok) {
    throw new Error('Фото збережено в профілі, але файл недоступний на сервері. Перезапустіть backend.');
  }

  return { photoUrl };
}
