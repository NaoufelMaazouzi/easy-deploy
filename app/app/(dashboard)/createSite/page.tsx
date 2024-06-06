"use client";

import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { createSite, fetchCitiesInRadius, generateServices } from "@/lib/actions";
import { toast } from "sonner";
import va from "@vercel/analytics";
import { useRouter } from "next/navigation";
import DomainConfiguration from "@/components/form/domain-configuration";
import SearchBar from '@/components/SearchBar/index';
import Tag from "@/components/tags.";
import ClipLoader from "react-spinners/ClipLoader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2 } from "lucide-react"


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
  secondaryActivityCities: Location[],
  services: string[]
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
    secondaryActivityCities: [],
    services: []
  });
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [inputServices, setInputServices] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

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
        const cities = await fetchCitiesInRadius({
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

  const removeTag = <T extends keyof SiteData>(property: T, value: string) => {
    setData(prevData => ({
      ...prevData,
      [property]: Array.isArray(prevData[property])
        ? (prevData[property] as unknown as (Location | string)[]).filter((item: Location | string) =>
            typeof item === "string" ? item !== value : item.uniqueId !== value
          )
        : prevData[property]
    }));
    if(property === "services") {
      const filteredServices = selectedServices.filter(e => e !== value);
      setSelectedServices(filteredServices)
    }
  };

  const checkServicesInput = () => {
    if(!inputServices) {
      return toast.error('Veuillez entrer un service')
    } else if (!data.services.includes(inputServices)) {
      setData(prevData => ({
            ...prevData,
            services: [...prevData.services, inputServices]
        }))
      return setInputServices('')
    }
    return toast.error('Service déjà présent')
  }

  const generateByIA = async () => {
    if(!data.services.length) {
      return toast.error("Veuillez ajouter un service d'abord")
    } else if(!selectedServices.length) {
      return toast.error("Veuillez d'abord séléctionner des services en cliquant dessus")
    }
    setLoadingAI(true);
    const result = await generateServices(selectedServices)
    setLoadingAI(false);
    setData(prevData => ({
      ...prevData,
      services: [...prevData.services, ...result.result]
    }))
  }

  const selectTag = (value: string) => {
    if(selectedServices.includes(value)) {
      return setSelectedServices(selectedServices.filter(e => e !== value))
    } else {
      return setSelectedServices([...selectedServices, value])
    }
  }

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
          <Label htmlFor="name">Nom de votre site</Label>
          <Input
            name="name"
            type="text"
            placeholder="Mon site web"
            autoFocus
            value={data.name}
            onChange={(e) => setData(prevData => ({
              ...prevData,
              name: e.target.value
            }))}
            maxLength={32}
            required
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="subdomain">Sous-domaine</Label>
          <div className="flex w-full max-w-md">
            <Input
              name="subdomain"
              type="text"
              placeholder="MonSousDomaines"
              value={data.subdomain}
              onChange={(e) => setData(prevData => ({
                ...prevData,
                subdomain: e.target.value
              }))}
              autoCapitalize="off"
              pattern="[a-zA-Z0-9\-]+" // only allow lowercase letters, numbers, and dashes
              maxLength={32}
              required
            />
            <div className="flex items-center rounded-r-lg border border-l-0 border-stone-200 bg-stone-100 px-3 text-sm dark:border-stone-600 dark:bg-stone-800 dark:text-stone-400">
              .{process.env.NEXT_PUBLIC_ROOT_DOMAIN}
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="customDomain">Domaine personnalisé</Label>
          <div className="flex w-full max-w-md">
            <Input
              name="customDomain"
              type="text"
              placeholder="domainePerso.com"
              value={data.customDomain}
              onChange={(e) => setData(prevData => ({
                ...prevData,
                customDomain: e.target.value
              }))}
              autoCapitalize="off"
              pattern="[a-zA-Z0-9\-]+" // only allow lowercase letters, numbers, and dashes
              maxLength={32}
              required
            />
          </div>
        </div>
        {data.customDomain && (
          <DomainConfiguration domain={data.customDomain} />
        )}

        <div className="flex flex-col space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            name="description"
            placeholder="Description de mon site"
            value={data.description}
            onChange={(e) => setData(prevData => ({
              ...prevData,
              description: e.target.value
            }))}
            maxLength={140}
            rows={3}
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="corporateName">Raison sociale</Label>
          <Input
            name="corporateName"
            type="text"
            placeholder="Raison sociale"
            autoFocus
            value={data.corporateName}
            onChange={(e) => setData(prevData => ({
              ...prevData,
              corporateName: e.target.value
            }))}
            maxLength={32}
            required
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="mainActivityCity">Adresse du siège social</Label>
          <SearchBar<SiteData> nameOfProperty="headquartersCity" setData={setData} placeHolder="Recherche d'une adresse"/>
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="headquartersCity">Votre ville principale d'activité</Label>
          <SearchBar<SiteData> nameOfProperty="mainActivityCity" setData={setData} placeHolder="Recherche d'une ville"/>
        </div>

        <div className="flex flex-col space-y-2">
          <Label htmlFor="radius">Vos villes secondaires d'activité (rayon autour de votre ville principale d'activité)</Label>
          <Select
            defaultValue="0"
            onValueChange={(value: string) => setData(prevData => ({
              ...prevData,
              radius: parseInt(value)
            }))}
          >
            <SelectTrigger className="w-[380px]">
              <SelectValue placeholder="Choisissez un rayon" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Rayon</SelectLabel>
                <SelectItem value="0">Non</SelectItem>
                <SelectItem value="5">5km</SelectItem>
                <SelectItem value="10">10km</SelectItem>
                <SelectItem value="15">15km</SelectItem>
                <SelectItem value="20">20km</SelectItem>
                <SelectItem value="25">25km</SelectItem>
                <SelectItem value="30">30km</SelectItem>
                <SelectItem value="35">35km</SelectItem>
                <SelectItem value="40">40km</SelectItem>
                <SelectItem value="45">45km</SelectItem>
                <SelectItem value="50">50km</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
            <div className="flex justify-center items-center">
              <ClipLoader color={"#3498db"} loading={loading} size={30} />
            </div>
          ) : data.secondaryActivityCities.length > 0 && (
            <div className="container mx-auto p-4">
              <div className="flex flex-wrap gap-2">
                {data.secondaryActivityCities.map(city => (
                  <Tag
                    key={city.uniqueId}
                    text={city.name}
                    onRemove={() => removeTag('secondaryActivityCities', city.uniqueId)}
                    isSelected={false}
                  />
                ))}
              </div>
            </div>
          )}

        <div className="flex flex-col space-y-2">
          <Label htmlFor="secondaryActivityCities">Ajouter manuellement une ville d'activité secondaire</Label>
          <SearchBar<SiteData> nameOfProperty="secondaryActivityCities" setData={setData} placeHolder="Recherche d'une ville"/>
        </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="services">Vos services</Label>
          <div className="flex space-x-2">
            <Input
              value={inputServices}
              name="services"
              type="text"
              placeholder="Peinture"
              onChange={e => setInputServices(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => checkServicesInput()}
            >
              Ajouter
            </Button>
            <Button
              variant="outline"
              onClick={() => generateByIA()}
              disabled={loadingAI}
            >
              <Bot className="mr-2.5 h-4 w-4" />
              {loadingAI && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Générer
            </Button>
          </div>
          <div className="flex flex-wrap space-x-2">
            {data.services.map((service, index) => (
              <Tag
                key={index}
                text={service}
                onRemove={() => removeTag('services', service)}
                onSelected={() => selectTag(service)}
                isSelected={selectedServices.includes(service)}
              />
            ))}
          </div>
          </div>


      </div>
    </form>
    </div>
  );
}
