/** Types for the /api/publish_from_device and /api/search_location endpoints. */

export interface PublishBody {
  photos_b64: string[];
  caption: string;
  username: string;
  password: string;
  location_lat?: number;
  location_lon?: number;
  location_name?: string;
}

export interface PublishResult {
  success: boolean;
  post_id?: string;
  error?: string;
}

export interface SearchLocationBody {
  username: string;
  password: string;
  lat?: number;
  lon?: number;
  name?: string;
}

export interface LocationResult {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
