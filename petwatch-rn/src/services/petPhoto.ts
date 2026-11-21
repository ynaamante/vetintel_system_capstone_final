import { ownerCareApi, petsApi } from './api';

// Confirm persistence with a separate read before announcing success.
export async function savePetPhoto(id: string, clinic: boolean, data: string, token: string) {
  const uploaded = await ownerCareApi.uploadPhoto(id, clinic, data, token);
  if (!uploaded?.photo_url) throw new Error('The server did not confirm the photo upload. Please try again.');
  const saved = clinic
    ? (await ownerCareApi.overview(token)).clinicPets.find((pet: any) => String(pet.id) === id)
    : await petsApi.getById(id, token);
  if (!saved?.photo_url || saved.photo_url !== uploaded.photo_url) {
    throw new Error('We could not verify the saved photo. Please reload your profile and try again.');
  }
  return { ...saved, source: clinic ? 'clinic' : 'account' };
}
