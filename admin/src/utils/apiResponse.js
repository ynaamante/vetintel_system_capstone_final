export async function readApiResponse(response, fallback = 'Unable to load clinic data.') {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error(response.status === 404
      ? 'This API endpoint is unavailable. The backend needs to be restarted with the latest code.'
      : 'The API returned a webpage instead of clinic data. Check the backend connection.');
  }
  let body;
  try { body = await response.json(); } catch { throw new Error('The API returned an invalid response. Please refresh and try again.'); }
  if (!response.ok) throw new Error(body.error || fallback);
  return body;
}
