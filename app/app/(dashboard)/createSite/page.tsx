"use client";

import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { createSite } from "@/lib/actions";
import { toast } from "sonner";
import va from "@vercel/analytics";
import { useRouter } from "next/navigation";
import DomainConfiguration from "@/components/form/domain-configuration";
import SearchBar from '@/components/SearchBar/index';
import Tag from "@/components/tags.";
import ClipLoader from "react-spinners/ClipLoader";
import axios from "axios";

export interface Location {
  uniqueId: string,
  name: string;
  lat: number;
  lng: number;
}

interface SiteData {
  name: string,
  subdomain: string,
  description: string,
  customDomain: string,
  corporateName: string,
  radius: number,
  headquartersCity: Location,
  mainActivityCity: Location,
  secondaryActivityCities: Location[]
};

export default function CreateSitePage() {

  const router = useRouter();
  const [data, setData] = useState<SiteData>({
    name: "",
    subdomain: "",
    description: "",
    customDomain: "",
    corporateName: "",
    radius: 0,
    headquartersCity: {
      uniqueId: '',
      name: '',
      lat: 0,
      lng: 0
    },
    mainActivityCity: {
      uniqueId: '',
      name: '',
      lat: 0,
      lng: 0
    },
    secondaryActivityCities: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData((prev) => ({
      ...prev,
      subdomain: prev.name
        .toLowerCase()
        .trim()
        .replace(/[\W_]+/g, "-"),
    }));
  }, [data.name]);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const cities = await axios.post('/api/fetchCitiesInRadius', {
          lat: data.mainActivityCity.lat,
          lng: data.mainActivityCity.lng,
          radius: data.radius
      });
        setData(prevData => ({
          ...prevData,
          secondaryActivityCities: cities.data.filter((newCity: Location) => data.mainActivityCity.uniqueId !== newCity.uniqueId)
        }));
        setLoading(false);
      }
      if(data.radius !== 0) {
        fetchData().catch(error => {
          console.error(error);
          setLoading(false);
        });
      } else {
        setData(prevData => ({
          ...prevData,
          secondaryActivityCities: []
        }));
      }
  }, [data.radius, data.mainActivityCity]);

  const removeTag = (uniqueId: string) => {
    setData({
      ...data,
      secondaryActivityCities: data.secondaryActivityCities.filter(city => city.uniqueId !== uniqueId)
    })
  };

  return (
    <div className="flex flex-col space-y-6">
      <h1 className="font-cal text-3xl font-bold dark:text-white">
        Créer votre site web
      </h1>
      <form
        action={async (data: FormData) =>
          createSite(data).then((res: any) => {
            if (res.error) {
              toast.error(res.error);
            } else {
              va.track("Created Site");
              const { id } = res;
              router.refresh();
              router.push(`/site/${id}`);
              toast.success(`Successfully created site!`);
            }
        })
      }
      className="md:max-w-7xl"
    >
      <div className="relative flex flex-col space-y-4 p-5 md:p-10">

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-medium text-stone-500 dark:text-stone-400"
          >
            Nom de votre site
          </label>
          <input
            name="name"
            type="text"
            placeholder="Mon site web"
            autoFocus
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            maxLength={32}
            required
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="subdomain"
            className="text-sm font-medium text-stone-500"
          >
            Sous-domaine
          </label>
          <div className="flex w-full max-w-md">
            <input
              name="subdomain"
              type="text"
              placeholder="MonSousDomaines"
              value={data.subdomain}
              onChange={(e) => setData({ ...data, subdomain: e.target.value })}
              autoCapitalize="off"
              pattern="[a-zA-Z0-9\-]+" // only allow lowercase letters, numbers, and dashes
              maxLength={32}
              required
              className="w-full rounded-l-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
            />
            <div className="flex items-center rounded-r-lg border border-l-0 border-stone-200 bg-stone-100 px-3 text-sm dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400">
              .{process.env.NEXT_PUBLIC_ROOT_DOMAIN}
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="customDomain"
            className="text-sm font-medium text-stone-500"
          >
            Domaine personnalisé
          </label>
          <div className="flex w-full max-w-md">
            <input
              name="customDomain"
              type="text"
              placeholder="domainePerso.com"
              value={data.customDomain}
              onChange={(e) => setData({ ...data, customDomain: e.target.value })}
              autoCapitalize="off"
              pattern="[a-zA-Z0-9\-]+" // only allow lowercase letters, numbers, and dashes
              maxLength={32}
              required
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
            />
          </div>
        </div>
        {data.customDomain && (
          <DomainConfiguration domain={data.customDomain} />
        )}

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="description"
            className="text-sm font-medium text-stone-500"
          >
            Description
          </label>
          <textarea
            name="description"
            placeholder="Description de mon site"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            maxLength={140}
            rows={3}
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black  focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="corporateName"
            className="text-sm font-medium text-stone-500 dark:text-stone-400"
          >
            Raison sociale
          </label>
          <input
            name="corporateName"
            type="text"
            placeholder="Raison sociale"
            autoFocus
            value={data.corporateName}
            onChange={(e) => setData({ ...data, corporateName: e.target.value })}
            maxLength={32}
            required
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="headquartersCity"
            className="text-sm font-medium text-stone-500 dark:text-stone-400"
          >
            Adresse du siège social
          </label>
        </div>
        <SearchBar<SiteData> nameOfProperty="headquartersCity" setData={setData} />

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="mainActivityCity"
            className="text-sm font-medium text-stone-500 dark:text-stone-400"
          >
            Votre ville principale d'activité 
          </label>
        </div>
        <SearchBar<SiteData> nameOfProperty="mainActivityCity" setData={setData} />

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="radius"
            className="w-full text-sm font-medium text-stone-500 dark:text-stone-400"
          >
            Vos villes secondaires d'activité (rayon autour de votre ville principale d'activité)
          </label>
          <select
            name="radius"
            id="radius-select"
            onChange={(e) => setData({ ...data, radius: parseInt(e.target.value) })}
            className="w-full rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600 placeholder:text-stone-400 focus:border-black focus:outline-none focus:ring-black dark:border-stone-600 dark:bg-black dark:text-white dark:placeholder-stone-700 dark:focus:ring-white"
          >
            <option value="0">NON</option>
            <option value="5">5KM</option>
            <option value="10">10KM</option>
            <option value="15">15KM</option>
            <option value="20">20KM</option>
            <option value="25">25KM</option>
            <option value="30">30KM</option>
            <option value="35">35KM</option>
            <option value="40">40KM</option>
            <option value="45">45KM</option>
            <option value="50">50KM</option>
          </select>
        </div>

        {loading ? (
            <div className="flex justify-center items-center">
              <ClipLoader color={"#3498db"} loading={loading} size={30} />
            </div>
          ) : data.secondaryActivityCities.length > 0 && (
            <div className="container mx-auto p-4">
              <div className="flex flex-wrap gap-2">
                {data.secondaryActivityCities.map(city => (
                  <Tag key={city.uniqueId} label={city.name} onRemove={() => removeTag(city.uniqueId)} />
                ))}
              </div>
            </div>
          )}

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="secondaryActivityCities"
            className="text-sm font-medium text-stone-500 dark:text-stone-400"
          >
           Ajouter manuellement une ville d'activité secondaire
          </label>
          <SearchBar<SiteData> nameOfProperty="secondaryActivityCities" setData={setData} />
        </div>

      </div>
    </form>
    </div>
  );
}
