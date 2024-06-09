"use server";

import prisma from "@/lib/prisma";
import { Post, Site } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { withPostAuth, withSiteAuth } from "./auth";
import { getSession } from "@/lib/auth";
import {
  addDomainToVercel,
  // getApexDomain,
  removeDomainFromVercelProject,
  // removeDomainFromVercelTeam,
  validDomainRegex,
} from "@/lib/domains";
import { put } from "@vercel/blob";
import { customAlphabet } from "nanoid";
import { formatLocationAddress, getBlurDataURL } from "@/lib/utils";
import { authenticatedAction } from "./safe-actions";
import { z } from "zod";
import axios from "axios";
// import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { formSchema } from "@/app/app/(dashboard)/createSite/siteSchema";
import { Client } from "@upstash/qstash";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7,
); // 7-character random string

export const createSite = authenticatedAction(
  formSchema,
  async ({ name }, { userId }) => {
    console.log(name, userId);
  },
);

// export const createSite = async (formData: FormData) => {
//   const session = await getSession();
//   if (!session?.user.id) {
//     return {
//       error: "Not authenticated",
//     };
//   }
//   const name = formData.get("name") as string;
//   const description = formData.get("description") as string;
//   const subdomain = formData.get("subdomain") as string;

//   try {
//     const response = await prisma.site.create({
//       data: {
//         name,
//         description,
//         subdomain,
//         user: {
//           connect: {
//             id: session.user.id,
//           },
//         },
//       },
//     });
//     await revalidateTag(
//       `${subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
//     );
//     return response;
//   } catch (error: any) {
//     if (error.code === "P2002") {
//       return {
//         error: `This subdomain is already taken`,
//       };
//     } else {
//       return {
//         error: error.message,
//       };
//     }
//   }
// };

export const updateSite = withSiteAuth(
  async (formData: FormData, site: Site, key: string) => {
    const value = formData.get(key) as string;

    try {
      let response;

      if (key === "customDomain") {
        if (value.includes("vercel.pub")) {
          return {
            error: "Cannot use vercel.pub subdomain as your custom domain",
          };

          // if the custom domain is valid, we need to add it to Vercel
        } else if (validDomainRegex.test(value)) {
          response = await prisma.site.update({
            where: {
              id: site.id,
            },
            data: {
              customDomain: value,
            },
          });
          await Promise.all([
            addDomainToVercel(value),
            // Optional: add www subdomain as well and redirect to apex domain
            // addDomainToVercel(`www.${value}`),
          ]);

          // empty value means the user wants to remove the custom domain
        } else if (value === "") {
          response = await prisma.site.update({
            where: {
              id: site.id,
            },
            data: {
              customDomain: null,
            },
          });
        }

        // if the site had a different customDomain before, we need to remove it from Vercel
        if (site.customDomain && site.customDomain !== value) {
          response = await removeDomainFromVercelProject(site.customDomain);

          /* Optional: remove domain from Vercel team 

          // first, we need to check if the apex domain is being used by other sites
          const apexDomain = getApexDomain(`https://${site.customDomain}`);
          const domainCount = await prisma.site.count({
            where: {
              OR: [
                {
                  customDomain: apexDomain,
                },
                {
                  customDomain: {
                    endsWith: `.${apexDomain}`,
                  },
                },
              ],
            },
          });

          // if the apex domain is being used by other sites
          // we should only remove it from our Vercel project
          if (domainCount >= 1) {
            await removeDomainFromVercelProject(site.customDomain);
          } else {
            // this is the only site using this apex domain
            // so we can remove it entirely from our Vercel team
            await removeDomainFromVercelTeam(
              site.customDomain
            );
          }
          
          */
        }
      } else if (key === "image" || key === "logo") {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return {
            error:
              "Missing BLOB_READ_WRITE_TOKEN token. Note: Vercel Blob is currently in beta – please fill out this form for access: https://tally.so/r/nPDMNd",
          };
        }

        const file = formData.get(key) as File;
        const filename = `${nanoid()}.${file.type.split("/")[1]}`;

        const { url } = await put(filename, file, {
          access: "public",
        });

        const blurhash = key === "image" ? await getBlurDataURL(url) : null;

        response = await prisma.site.update({
          where: {
            id: site.id,
          },
          data: {
            [key]: url,
            ...(blurhash && { imageBlurhash: blurhash }),
          },
        });
      } else {
        response = await prisma.site.update({
          where: {
            id: site.id,
          },
          data: {
            [key]: value,
          },
        });
      }
      console.log(
        "Updated site data! Revalidating tags: ",
        `${site.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
        `${site.customDomain}-metadata`,
      );
      await revalidateTag(
        `${site.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
      );
      site.customDomain &&
        (await revalidateTag(`${site.customDomain}-metadata`));

      return response;
    } catch (error: any) {
      if (error.code === "P2002") {
        return {
          error: `This ${key} is already taken`,
        };
      } else {
        return {
          error: error.message,
        };
      }
    }
  },
);

export const deleteSite = withSiteAuth(async (_: FormData, site: Site) => {
  try {
    const response = await prisma.site.delete({
      where: {
        id: site.id,
      },
    });
    await revalidateTag(
      `${site.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
    );
    response.customDomain &&
      (await revalidateTag(`${site.customDomain}-metadata`));
    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
});

export const getSiteFromPostId = async (postId: string) => {
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      siteId: true,
    },
  });
  return post?.siteId;
};

export const createPost = withSiteAuth(async (_: FormData, site: Site) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const response = await prisma.post.create({
    data: {
      siteId: site.id,
      userId: session.user.id,
    },
  });

  await revalidateTag(
    `${site.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-posts`,
  );
  site.customDomain && (await revalidateTag(`${site.customDomain}-posts`));

  return response;
});

// creating a separate function for this because we're not using FormData
export const updatePost = async (data: Post) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const post = await prisma.post.findUnique({
    where: {
      id: data.id,
    },
    include: {
      site: true,
    },
  });
  if (!post || post.userId !== session.user.id) {
    return {
      error: "Post not found",
    };
  }
  try {
    const response = await prisma.post.update({
      where: {
        id: data.id,
      },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
      },
    });

    await revalidateTag(
      `${post.site?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-posts`,
    );
    await revalidateTag(
      `${post.site?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-${post.slug}`,
    );

    // if the site has a custom domain, we need to revalidate those tags too
    post.site?.customDomain &&
      (await revalidateTag(`${post.site?.customDomain}-posts`),
      await revalidateTag(`${post.site?.customDomain}-${post.slug}`));

    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
};

export const updatePostMetadata = withPostAuth(
  async (
    formData: FormData,
    post: Post & {
      site: Site;
    },
    key: string,
  ) => {
    const value = formData.get(key) as string;

    try {
      let response;
      if (key === "image") {
        const file = formData.get("image") as File;
        const filename = `${nanoid()}.${file.type.split("/")[1]}`;

        const { url } = await put(filename, file, {
          access: "public",
        });

        const blurhash = await getBlurDataURL(url);

        response = await prisma.post.update({
          where: {
            id: post.id,
          },
          data: {
            image: url,
            imageBlurhash: blurhash,
          },
        });
      } else {
        response = await prisma.post.update({
          where: {
            id: post.id,
          },
          data: {
            [key]: key === "published" ? value === "true" : value,
          },
        });
      }

      await revalidateTag(
        `${post.site?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-posts`,
      );
      await revalidateTag(
        `${post.site?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-${post.slug}`,
      );

      // if the site has a custom domain, we need to revalidate those tags too
      post.site?.customDomain &&
        (await revalidateTag(`${post.site?.customDomain}-posts`),
        await revalidateTag(`${post.site?.customDomain}-${post.slug}`));

      return response;
    } catch (error: any) {
      if (error.code === "P2002") {
        return {
          error: `This slug is already in use`,
        };
      } else {
        return {
          error: error.message,
        };
      }
    }
  },
);

export const deletePost = withPostAuth(async (_: FormData, post: Post) => {
  try {
    const response = await prisma.post.delete({
      where: {
        id: post.id,
      },
      select: {
        siteId: true,
      },
    });
    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
});

export const editUser = async (
  formData: FormData,
  _id: unknown,
  key: string,
) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const value = formData.get(key) as string;

  try {
    const response = await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        [key]: value,
      },
    });
    return response;
  } catch (error: any) {
    if (error.code === "P2002") {
      return {
        error: `This ${key} is already in use`,
      };
    } else {
      return {
        error: error.message,
      };
    }
  }
};

export const autocompleteSearch = authenticatedAction(
  z.object({ query: z.string() }),
  async ({ query }, { userId }) => {
    if (!process.env.GEOAPIFY_API_KEY) {
      return new Response(
        "Missing GEOAPIFY_API_KEY. Don't forget to add that to your .env file.",
        {
          status: 401,
        },
      );
    }
    try {
      const response = await axios.get(
        `https://api.geoapify.com/v1/geocode/autocomplete`,
        {
          params: {
            text: query,
            apiKey: process.env.GEOAPIFY_API_KEY,
          },
        },
      );
      const result = response.data.features
        .filter((e: any) => e.properties.formatted || e.properties.name)
        .map((city: any) => {
          const formattedAddress = formatLocationAddress(city);
          return {
            uniqueId: `${city.properties.lat}-${city.properties.lon}`,
            name: formattedAddress,
            lat: city.properties.lat,
            lng: city.properties.lon,
          };
        });
      return result;
    } catch (error) {
      throw new Error("Erreur lors de la recherche des villes autocomplete");
    }
  },
);

export const fetchCitiesInRadius = authenticatedAction(
  z.object({ lat: z.number(), lng: z.number(), radius: z.number() }),
  async ({ lat, lng, radius }, { userId }) => {
    if (!process.env.GEOAPIFY_API_KEY) {
      throw new Error(
        "Missing GEOAPIFY_API_KEY. Don't forget to add that to your .env file.",
      );
    }
    const radiusNumber =
      typeof radius === "string" ? parseFloat(radius) : radius;
    if (typeof radiusNumber !== "number" || isNaN(radiusNumber)) {
      throw new Error("Missing or invalid 'radius' parameter.");
    }
    try {
      const response = await axios.get("https://api.geoapify.com/v2/places", {
        params: {
          categories:
            "populated_place.city,populated_place.town,populated_place.village",
          filter: `circle:${lng},${lat},${radiusNumber * 1000}`,
          limit: 100,
          apiKey: process.env.GEOAPIFY_API_KEY,
        },
      });
      const cities = response.data.features.filter(
        (place: any) =>
          [
            "populated_place.city",
            "populated_place.town",
            "populated_place.village",
          ].some((i: any) => place.properties.categories.includes(i)) &&
          (place.properties.formatted || place.properties.name),
      );
      const result = cities.map((city: any) => {
        const formattedAddress = formatLocationAddress(city);
        return {
          uniqueId: `${city.properties.lat}-${city.properties.lon}`,
          name: formattedAddress,
          lat: city.properties.lat,
          lng: city.properties.lon,
        };
      });
      return result;
    } catch (error) {
      throw new Error("Erreur lors de la recherche des villes dans le rayon.");
    }
  },
);

const perplexityModel = createOpenAI({
  baseURL: "https://api.perplexity.ai",
  apiKey: process.env.PERPLEXITY_API_KEY,
});

// export async function generateServices(input: string) {
//   try {
//     const { object: result } = await generateObject({
//       model: perplexityModel("mixtral-8x7b-instruct"),
//       system:
//         "Tu es un expert des domaines artisanaux tels que la sérrurerie, la plomberie, la peinture etc.",
//       prompt: `Génère en français des services qui sont dans les même domaines que je te donne. Par exemple si je te donne comme domaine "plomberie", tu me réponds "réparation canalisation". Voici les domaines qui sont séparés par des virgules: ${input}. Il me faut 10 services par domaine`,
//       schema: z.object({
//         result: z.array(z.string().describe("Nom du service")),
//       }),
//       mode: "json",
//     });
//     if (result?.result) {
//       return result.result.map((name) => ({ name }));
//     }
//   } catch (error) {
//     throw new Error("Erreur lors de la génération avec l'IA.");
//   }
// }

export async function generateServices(input: string) {
  try {
    const client = new Client({
      token: process.env.QSTASH_TOKEN || "",
    });
    const res = await client.publishJSON({
      url: "https://api.perplexity.ai/chat/completions",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: {
        model: "mixtral-8x7b-instruct",
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert des domaines artisanaux tels que la sérrurerie, la plomberie, la peinture etc. Tu dois toujours me répondre seulement avec des mots clés séparés par des virgules comme cette phrase 'texte1,texte2,texte3'",
          },
          {
            role: "user",
            content: `Génère en français des services qui sont dans les même domaines que je te donne. Par exemple si je te donne comme domaine "plomberie", tu me réponds "réparation canalisation". Voici les domaines qui sont séparés par des virgules: ${input}. Il me faut 10 services par domaine`,
          },
        ],
      },
      callback: `${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/qstashWebhook`,
    });
    console.log(res);
  } catch (error) {
    console.log(error);
    throw new Error("Erreur lors de la génération de services avec l'IA.");
  }
}
