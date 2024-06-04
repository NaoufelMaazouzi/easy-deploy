import React from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';

interface TagProps {
    label: string;
    onRemove: () => void;
}

const Tag = ({ label, onRemove }: TagProps) => {
    return (
        <div className="flex items-center bg-gray-800 text-white rounded-full px-3 py-1 m-1 text-sm font-medium">
            <span>{label}</span>
            <XMarkIcon 
                className="h-5 w-5 ml-2 cursor-pointer" 
                onClick={onRemove} 
            />
        </div>
    );
};

export default Tag;