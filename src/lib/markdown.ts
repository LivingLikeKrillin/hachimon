import { defaultUrlTransform } from 'react-markdown';

/** data:image/* 는 허용, 그 외는 react-markdown 기본 안전 변환(http/https/mailto 등). */
export function imageUrlTransform(url: string): string {
  if (/^data:image\//i.test(url)) return url;
  return defaultUrlTransform(url);
}
