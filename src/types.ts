export type ListingType = 'Exchange' | 'Sell' | 'Buy';
export type BookCondition = 'Like New' | 'Good' | 'Fair' | 'Any';
export type RequestStatus = 'Pending' | 'Accepted' | 'Declined';

export interface GeoLocation {
  type: 'Point';
  /** Stored as [longitude, latitude] per MongoDB GeoJSON & 2dsphere spec */
  coordinates: [number, number];
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  city: string;
  createdAt: string;
  emailVerified?: boolean;
}

export interface BookListing {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  category: string;
  language: string;
  listingType: ListingType;
  condition: BookCondition;
  price: number;
  currency: string;
  exchangeFor?: string;
  description: string;
  imageUrl: string;
  city: string;
  neighborhood?: string;
  location: GeoLocation;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  distanceKm?: number;
}

export interface BookRequest {
  id: string;
  bookId: string;
  bookTitle: string;
  bookType: ListingType;
  bookImageUrl: string;
  ownerId: string;
  ownerName: string;
  requesterId: string;
  requesterName: string;
  requesterCity: string;
  offerBookTitle?: string;
  message: string;
  contactNote: string;
  status: RequestStatus;
  createdAt: string;
}

export interface BookReview {
  id: string;
  bookId: string;
  authorId: string;
  authorName: string;
  authorCity: string;
  rating: number;
  comment: string;
  finishedReading: boolean;
  createdAt: string;
}

export interface BookAnswer {
  id: string;
  authorId: string;
  authorName: string;
  hasReadBook: boolean;
  body: string;
  createdAt: string;
}

export interface BookQuestion {
  id: string;
  bookId: string;
  authorId: string;
  authorName: string;
  question: string;
  answers: BookAnswer[];
  createdAt: string;
}
