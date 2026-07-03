import localFont from 'next/font/local';

export const destinationPopupPoppins = localFont({
  src: [
    {
      path: './fonts/poppins-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/poppins-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
});
