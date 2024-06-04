import { NextResponse } from "next/server";
import axios from 'axios';
import { formatLocationAddress } from "@/lib/utils";

export const runtime = "edge";

export async function POST(req: Request) {
    if (!process.env.GEOAPIFY_API_KEY) {
        return new Response(
            "Missing GEOAPIFY_API_KEY. Don't forget to add that to your .env file.",
            {
                status: 401,
            },
        );
    }
    let { query} = await req.json();
    try {
        const response = await axios.get(`https://api.geoapify.com/v1/geocode/autocomplete`, {
            params: {
                text: query,
                apiKey: process.env.GEOAPIFY_API_KEY,
            },
        });
        const result = response.data.features.filter((e: any) => (e.properties.formatted || e.properties.name)).map((city: any) => {
            const formattedAddress = formatLocationAddress(city)
            return {
                uniqueId: `${city.properties.lat}-${city.properties.lon}`,
                name: formattedAddress,
                lat: city.properties.lat,
                lng: city.properties.lon,
            }
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Erreur lors de la recherche des villes autocomplete:', error);
        return new Response(
            'Erreur lors de la recherche des villes autocomplete.',
            {
                status: 500,
            },
        );
    }
}

// export const autocompleteSearch = async (q: string): Promise<Location[]> => {
//   try {
//     const response = await axios.get('http://api.geonames.org/streetNameLookupJSON', {
//       params: {
//         q,
//         username: 'easyDeploy'
//       }
//     });
//     return response.data.address;
//   } catch (error) {
//     console.error('Erreur lors de la recherche des villes dans le rayon :', error);
//     return [];
//   }
// };