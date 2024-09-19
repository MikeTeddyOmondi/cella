import { useEffect } from 'react';

// Custom hook for focusing an element by id
const useFocusById = (id: string) => {
  useEffect(() => {
    const element = document.getElementById(id);
    if (!element) return;
    element.focus();
  }, [id]);
};

export default useFocusById;
