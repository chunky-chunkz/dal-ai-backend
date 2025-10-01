/**
 * Task: Fetch basic user profile via Microsoft Graph.
 * Requirements:
 * - export async function getMe(accessToken): Promise<{id:string, displayName:string, mail?:string, userPrincipalName?:string}>
 * - GET https://graph.microsoft.com/v1.0/me
 * - Throw on non-200; return normalized object.
 */

// Microsoft Graph API base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// User profile interface for normalized response
export interface UserProfile {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
}

// Raw Microsoft Graph user response interface
interface GraphUserResponse {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  officeLocation?: string;
}

/**
 * Fetch basic user profile from Microsoft Graph API
 * @param accessToken - Valid Microsoft access token with User.Read scope
 * @returns Normalized user profile object
 * @throws Error if API call fails or returns non-200 status
 */
export async function getMe(accessToken: string): Promise<UserProfile> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${GRAPH_API_BASE}/me`;
  
  try {
    console.log('🔍 Fetching user profile from Microsoft Graph...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Microsoft Graph API error: ${response.status} - ${errorText}`);
      
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Invalid or expired access token');
      } else if (response.status === 403) {
        throw new Error('Insufficient permissions to access user profile');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded for Microsoft Graph API');
      } else {
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
      }
    }

    const userData = await response.json() as GraphUserResponse;
    
    // Normalize the response to our interface
    const normalizedUser: UserProfile = {
      id: userData.id,
      displayName: userData.displayName || 'Unknown User',
      mail: userData.mail || undefined,
      userPrincipalName: userData.userPrincipalName || undefined
    };

    console.log(`✅ User profile fetched successfully: ${normalizedUser.displayName} (${normalizedUser.id})`);
    
    return normalizedUser;

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error fetching user profile:', error.message);
      throw error;
    } else {
      console.error('❌ Unknown error fetching user profile:', error);
      throw new Error('Failed to fetch user profile from Microsoft Graph');
    }
  }
}

/**
 * Fetch extended user profile with additional fields
 * @param accessToken - Valid Microsoft access token
 * @returns Extended user profile with additional fields
 */
export async function getMeExtended(accessToken: string): Promise<GraphUserResponse> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${GRAPH_API_BASE}/me`;
  
  try {
    console.log('🔍 Fetching extended user profile from Microsoft Graph...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
    }

    const userData = await response.json() as GraphUserResponse;
    
    console.log(`✅ Extended user profile fetched: ${userData.displayName}`);
    
    return userData;

  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error fetching extended user profile:', error.message);
      throw error;
    } else {
      console.error('❌ Unknown error fetching extended user profile:', error);
      throw new Error('Failed to fetch extended user profile from Microsoft Graph');
    }
  }
}

/**
 * Get user's profile photo URL
 * @param accessToken - Valid Microsoft access token
 * @param size - Photo size (e.g., '48x48', '96x96', '240x240')
 * @returns Photo URL or null if not available
 */
export async function getUserPhoto(accessToken: string, size: string = '96x96'): Promise<string | null> {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${GRAPH_API_BASE}/me/photos/${size}/$value`;
  
  try {
    console.log(`🖼️ Fetching user photo (${size}) from Microsoft Graph...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (response.ok) {
      // Convert photo blob to base64 data URL (simplified for server environment)
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log(`✅ User photo fetched successfully (${size})`);
      return `data:${mimeType};base64,${base64}`;
    } else if (response.status === 404) {
      console.log('ℹ️ No profile photo available');
      return null;
    } else {
      const errorText = await response.text();
      console.warn(`⚠️ Failed to fetch profile photo: ${response.status} - ${errorText}`);
      return null;
    }

  } catch (error) {
    console.warn('⚠️ Error fetching user photo:', error);
    return null;
  }
}

/**
 * Validate access token by making a simple Graph API call
 * @param accessToken - Access token to validate
 * @returns Boolean indicating if token is valid
 */
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  if (!accessToken) {
    return false;
  }

  try {
    await getMe(accessToken);
    return true;
  } catch (error) {
    console.log('❌ Access token validation failed:', error);
    return false;
  }
}
