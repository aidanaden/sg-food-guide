import { iconsPlugin, getIconCollections } from '@egoist/tailwindcss-icons';

/** @type {import('tailwindcss').Config} */
export default {
  plugins: [
    iconsPlugin({
      collections: getIconCollections(['ph']),
    }),
  ],
};
