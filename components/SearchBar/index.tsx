import { useState, useEffect, useRef, ChangeEvent, Dispatch, SetStateAction } from 'react';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { Location } from '@/app/app/(dashboard)/createSite/page';
import { toast } from 'sonner';
import { autocompleteSearch } from '@/lib/actions';
import { Input } from '../ui/input';

interface SearchBarProps<T> {
  nameOfProperty: string;
  placeHolder: string;
  setData: Dispatch<SetStateAction<T>>;
}

export default function SearchBar<T extends { [key: string]: any }>({
  nameOfProperty,
  placeHolder,
  setData,
}: SearchBarProps<T>) {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Location[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const [selectedResult, setSelectedResult] = useState<Location | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }

      try {
        if (!selectedResult) {
          const response = await autocompleteSearch({ query });
          setResults(response.data);
        }
      } catch (error) {
        console.error('Erreur lors de la recherche des adresses :', error);
      }
    };

    const timeoutId = setTimeout(fetchResults, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedResult]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowResults(true);
  };

  const updateArray = (arr: any[], obj: any) => {
    if(!arr.some(x => x.uniqueId === obj.uniqueId)) {
        arr.push(obj)
    } else {
        toast.error('Cette ville est déjà présente');
    }
    return arr
  }

  const handleResultClick = (result: Location) => {
    setSelectedResult(result);
    setQuery(result.name);
    setResults([]);
    setShowResults(false);

    if (nameOfProperty === "secondaryActivityCities") {
      setData((prevData) => ({
        ...prevData,
        [nameOfProperty]: updateArray([...(prevData[nameOfProperty] || [])], result),
      }));
      setQuery('');
    } else {
      setData((prevData) => ({
        ...prevData,
        [nameOfProperty]: result,
      }));
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
      setShowResults(false);
    }
  };

  const clearSearch = () => {
    setSelectedResult(null)
    setQuery('');
    setResults([]);
    setShowResults(false);

    if (nameOfProperty === "secondaryActivityCities") {
      setData((prevData) => ({
        ...prevData,
        [nameOfProperty]: []
      }));
    } else {
      setData((prevData) => ({
        ...prevData,
        [nameOfProperty]: {
          uniqueId: "",
          name: "",
          lat: 0,
          lng: 0
        }
      }));
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={searchBarRef} className="relative w-full">
      <div className="relative w-full">
        <Input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeHolder}
        />
        {query && (
          <XMarkIcon
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-stone-600 cursor-pointer dark:text-stone-400"
            onClick={clearSearch}
          />
        )}
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full rounded-md border border-stone-200 bg-stone-800 text-sm text-stone-200 dark:border-stone-600 dark:bg-black dark:text-white">
          {results.map((result) => (
            <li
              key={result.uniqueId}
              onClick={() => handleResultClick(result)}
              className="cursor-pointer p-2 hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              {result.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
