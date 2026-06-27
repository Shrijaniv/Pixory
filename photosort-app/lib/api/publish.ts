/** Instagram publishing and location search API calls. */

export async function publishFromDevice(params: {
  photosBase64: string[];
  caption: string;
  username: string;
  password: string;
  backendUrl: string;
  locationLat?: number;
  locationLon?: number;
  locationName?: string;
}): Promise<{ success: boolean; post_id?: string; error?: string }> {
  const res = await fetch(`${params.backendUrl}/api/publish_from_device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photos_b64:    params.photosBase64,
      caption:       params.caption,
      username:      params.username,
      password:      params.password,
      location_lat:  params.locationLat,
      location_lon:  params.locationLon,
      location_name: params.locationName,
    }),
  });
  return res.json();
}

export async function fetchAccountInfo(params: {
  username: string;
  password: string;
  backendUrl: string;
}): Promise<{ success: boolean; username?: string; full_name?: string; profile_pic_url?: string; error?: string }> {
  try {
    const res = await fetch(`${params.backendUrl}/api/account_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: params.username, password: params.password }),
    });
    return res.json();
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'network error' };
  }
}

export async function searchLocation(params: {
  username: string;
  password: string;
  lat?: number;
  lon?: number;
  name?: string;
  backendUrl: string;
}): Promise<{ locations: Array<{ pk: string; name: string; lat?: number; lon?: number }> }> {
  try {
    const res = await fetch(`${params.backendUrl}/api/search_location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: params.username,
        password: params.password,
        lat:      params.lat,
        lon:      params.lon,
        name:     params.name,
      }),
    });
    return res.json();
  } catch {
    return { locations: [] };
  }
}
