import {
  renderSocialCard,
  socialImageAlt,
  socialImageContentType,
  socialImageSize,
} from "@/lib/seo/social-card";

export const alt = socialImageAlt;
export const size = socialImageSize;
export const contentType = socialImageContentType;

export default function Image() {
  return renderSocialCard();
}
