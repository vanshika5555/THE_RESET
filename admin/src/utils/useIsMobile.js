import { useEffect, useState } from 'react';

// Same breakpoint the CSS uses for the phone layout.
const QUERY = '(max-width: 768px)';

export default function useIsMobile() {
  const read = () =>
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches;

  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}