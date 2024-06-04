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
    const { lat, lng, radius } = await req.json();
    const radiusNumber = typeof radius === 'string' ? parseFloat(radius) : radius;
    if (typeof radiusNumber !== 'number' || isNaN(radiusNumber)) {
        return new Response(
            "Missing or invalid 'radius' parameter.",
            {
                status: 400,
            },
        );
    }
    try {
        const response = await axios.get('https://api.geoapify.com/v2/places', {
            params: {
                categories: 'populated_place.city,populated_place.town,populated_place.village',
                filter: `circle:${lng},${lat},${radiusNumber  * 1000}`,
                limit: 100,
                apiKey: process.env.GEOAPIFY_API_KEY
            }
        });
        const cities = response.data.features.filter((place: any) =>
            ['populated_place.city', 'populated_place.town', 'populated_place.village'].some((i: any) => place.properties.categories.includes(i))
            && (place.properties.formatted || place.properties.name)
        );
        const result = cities.map((city: any) => {
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
        console.error('Erreur lors de la recherche des villes dans le rayon :', error);
        return new Response(
            'Erreur lors de la recherche des villes dans le rayon.',
            { status: 500, },
        );
    }
}


// export const fetchCitiesInRadius = async (lat: number, lng: number, radius: number): Promise<any[]> => {
//     try {
//       const response = await axios.get('http://api.geonames.org/findNearbyPlaceNameJSON', {
//         params: {
//           lat,
//           lng: lng,
//           radius,
//           cities: 'cities1000',
//           maxRows: 500,
//           username: 'easyDeploy'
//         }
//       });
//       return response.data.geonames
//     } catch (error) {
//       console.error('Erreur lors de la recherche des villes dans le rayon :', error);
//       return [];
//     }
// };