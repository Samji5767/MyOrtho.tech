import { api } from './client';

export const PHOTO_TYPES = [
  'frontal_rest', 'frontal_smile', 'profile_rest', 'profile_smile',
  'three_quarter', 'three_quarter_smile',
  'intraoral_frontal', 'intraoral_upper_occlusal', 'intraoral_lower_occlusal',
  'buccal_left', 'buccal_right', 'buccal_both',
  'panoramic', 'lateral_ceph', 'other',
] as const;
export type PhotoType = typeof PHOTO_TYPES[number];

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  frontal_rest:              'Frontal (Rest)',
  frontal_smile:             'Frontal (Smile)',
  profile_rest:              'Profile (Rest)',
  profile_smile:             'Profile (Smile)',
  three_quarter:             '3/4 View (Rest)',
  three_quarter_smile:       '3/4 View (Smile)',
  intraoral_frontal:         'Intraoral Frontal',
  intraoral_upper_occlusal:  'Intraoral Upper Occlusal',
  intraoral_lower_occlusal:  'Intraoral Lower Occlusal',
  buccal_left:               'Buccal Left',
  buccal_right:              'Buccal Right',
  buccal_both:               'Buccal Both',
  panoramic:                 'Panoramic OPG',
  lateral_ceph:              'Lateral Ceph',
  other:                     'Other',
};

export const PHOTO_GROUPS: { label: string; types: PhotoType[] }[] = [
  {
    label: 'Facial',
    types: ['frontal_rest', 'frontal_smile', 'profile_rest', 'profile_smile', 'three_quarter', 'three_quarter_smile'],
  },
  {
    label: 'Intraoral',
    types: ['intraoral_frontal', 'intraoral_upper_occlusal', 'intraoral_lower_occlusal', 'buccal_left', 'buccal_right', 'buccal_both'],
  },
  {
    label: 'Radiographic',
    types: ['panoramic', 'lateral_ceph'],
  },
];

export interface PatientPhoto {
  id: string;
  caseId: string;
  photoType: PhotoType;
  filePath: string;
  fileSizeBytes: number;
  originalFilename: string | null;
  takenAt: string | null;
  notes: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
}

export interface UploadPhotoDto {
  photoType: PhotoType;
  filePath: string;
  fileSizeBytes: number;
  originalFilename?: string;
  takenAt?: string;
  notes?: string;
}

export const listPhotos = (caseId: string) =>
  api.get<PatientPhoto[]>(`/api/cases/${caseId}/photos`);

export const uploadPhoto = (caseId: string, dto: UploadPhotoDto) =>
  api.post<PatientPhoto>(`/api/cases/${caseId}/photos`, dto);

export const deletePhoto = (caseId: string, photoId: string) =>
  api.delete<void>(`/api/cases/${caseId}/photos/${photoId}`);
