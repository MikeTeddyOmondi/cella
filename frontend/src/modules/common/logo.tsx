import { config } from 'config';
import { useThemeStore } from '~/store/theme';

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  iconColor?: string;
  textColor?: string;
  height?: number;
  iconOnly?: boolean;
}

function Logo({ className, iconColor, textColor, height = 50, iconOnly = false, ...props }: LogoProps) {
  const { mode } = useThemeStore();
  const defaultTextColor = mode === 'light' ? '#333' : '#fff';
  const defaultIconColor = config.themeColor;
  if (!textColor) textColor = defaultTextColor;
  if (!iconColor) iconColor = defaultIconColor;

  return (
    <>
      <svg
        id="svg-logo"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        className={className}
        width="100%"
        height={height}
        viewBox={`0 0 ${iconOnly ? 150 : 400} 150`}
      >
        <title>Logo</title>
        <g id="svg-logo-icon" fill="none" fillRule="evenodd" style={{ transformBox: 'fill-box' }} transform="rotate(0)">
          <path
            fill={iconColor}
            d="M112.9 59c.6 5.7.3 11.4-1 16.9v.5-.2l-.2.7a3.4 3.4 0 0 1-6.1.8L92 66.7l-.2-.1c-.7-.6-1-1.5-1-2.4l-.2-2.2v-.5a29.7 29.7 0 0 0-59.1 5.7v.5a29.7 29.7 0 0 0 45.1 22.1l.5-.2a3.4 3.4 0 1 1 3.6 5.6 36.4 36.4 0 1 1 16.5-35v.6l.2 1.6 8.8 7.2c.3-3 .3-6.1 0-9v-.9c-2.6-25-25-43-50-40.4h-.8a45.6 45.6 0 1 0 33 81.6l.5-.3c.7-.6 1.7-.7 2.5-.5.7 0 1.4.3 2 .7l13.4 11c.7.6 1.2 1.4 1.3 2.4l1 10.1 5.7 5.4L116 116a3.6 3.6 0 0 1 2.6-3l.2-.1L131 110l-5.4-4.3-10.2.3c-.8 0-1.6-.3-2.3-.8L65.7 66.8l-.2-.1A3.5 3.5 0 0 1 65 62l.1-.2 3.4-4.2-16.3-1.4 6.2 18.4-1 .3 1-.3a3.4 3.4 0 1 1-6.4 2l-7.6-22.8c-.4-1-.2-2.2.4-3.2l.1-.1c.7-.9 1.6-1.3 2.7-1.4h.4l27 2.4c1.2 0 2.3.8 2.9 2v.1c.5 1.2.4 2.5-.3 3.5l-.1.1-5.2 6.4 44 35.6 10.3-.3c.9 0 1.7.3 2.4.9l11.2 9c1 .9 1.5 2.1 1.3 3.4v.2a3.6 3.6 0 0 1-2.5 2.6h-.2l-16.3 3.9-1.6 18a3.6 3.6 0 0 1-5.9 2.3v-.1l-11.3-10.7c-.6-.5-1-1.3-1-2l-.1-.2-1-10-10.8-8.7c-6.9 4.8-15 7.8-23.8 8.8l-.6.1A52.2 52.2 0 0 1 8.9 70V69a52.3 52.3 0 0 1 46.6-56.5h.8A52.2 52.2 0 0 1 112.9 59Z"
          />
        </g>

        {!iconOnly && (
          <g id="svg-logo-text" fill={textColor} transform="translate(0,0)" fillRule="nonzero">
            <path
              xmlns="http://www.w3.org/2000/svg"
              d="M173.8 60.8v21c0 1.2-.3 2-1 2.8-.7.7-1.5 1-2.6 1a3.7 3.7 0 0 1-3.8-3.7V40.8c0-1.2.4-2.1 1.1-2.7.8-.6 1.7-1 2.7-1a4 4 0 0 1 2.4 1c.8.6 1.2 1.5 1.2 2.7v4a13 13 0 0 1 6.6-6.3c3-1.4 6-2.1 8.7-2.1 1.6 0 3.2.2 4.9.8 1 .3 1.9 1 2.4 1.8.5.9.5 1.9.2 3-.7 2.1-2.2 3-4.4 2.6-2-.6-3.6-.8-5-.8-4.2 0-7.5 1.6-9.9 4.8a20.2 20.2 0 0 0-3.5 12.2ZM225 85.6a22 22 0 0 1-16.7-7 25.2 25.2 0 0 1-6.6-18c0-7 2.2-12.9 6.6-17.4 4.4-4.6 10-6.8 16.7-6.8 7 0 12.7 2.4 17 7.4v-3c0-1.2.4-2.1 1.1-2.7a4 4 0 0 1 2.5-1c1 0 1.8.4 2.6 1s1.2 1.5 1.2 2.7v41a3.7 3.7 0 0 1-3.8 3.8c-1.1 0-2-.3-2.6-1-.7-.7-1-1.6-1-2.7v-4c-2 2.4-4.4 4.3-7.3 5.7-3 1.4-6.1 2-9.7 2Zm0-6.7c5.2 0 9.3-1.5 12.4-4.6 3-3 4.6-7.6 4.6-13.6 0-5.8-1.6-10.2-4.6-13.2a17 17 0 0 0-12.4-4.4c-4.7 0-8.5 1.7-11.4 5a18.6 18.6 0 0 0-4.3 12.6c0 5.1 1.4 9.4 4.3 13 3 3.5 6.7 5.2 11.4 5.2ZM284.2 85.6a22 22 0 0 1-16.8-7 25.2 25.2 0 0 1-6.5-18c0-7 2.2-12.9 6.5-17.4 4.4-4.6 10-6.8 16.8-6.8 7 0 12.6 2.4 17 7.4v-3c0-1.2.3-2.1 1-2.7a4 4 0 0 1 2.5-1c1 0 1.9.4 2.7 1 .7.6 1.1 1.5 1.1 2.7v41a3.7 3.7 0 0 1-3.8 3.8c-1 0-2-.3-2.6-1-.7-.7-1-1.6-1-2.7v-4c-2 2.4-4.4 4.3-7.3 5.7-2.9 1.4-6.1 2-9.6 2Zm0-6.7c5.1 0 9.3-1.5 12.3-4.6 3-3 4.6-7.6 4.6-13.6 0-5.8-1.5-10.2-4.6-13.2a17 17 0 0 0-12.3-4.4c-4.7 0-8.5 1.7-11.4 5a18.6 18.6 0 0 0-4.4 12.6c0 5.1 1.5 9.4 4.4 13 2.9 3.5 6.7 5.2 11.4 5.2ZM326.3 85.6a3.7 3.7 0 0 1-3.8-3.7v-65c0-1.1.4-2 1.1-2.6.8-.6 1.7-1 2.7-1a4 4 0 0 1 2.4 1c.8.6 1.2 1.5 1.2 2.7v33c0 1.9.5 2.8 1.6 2.8.6 0 1.1-.2 1.7-.7l22-15.2c.6-.4 1.3-.5 2-.5 1 0 1.8.3 2.5 1s1 1.6 1 2.7c0 1.4-.6 2.4-2 3.3l-18.5 12.2c-.7.5-1.1 1.1-1.1 1.8 0 .6.4 1.4 1.1 2.1l19.9 19.2c.4.4.7.8.8 1.2l.2 1.3c0 1.1-.4 2-1.2 2.8a4 4 0 0 1-3 1.1c-.6 0-1.3-.2-2-.8L333 62.2c-.8-.8-1.4-1.2-2-1.2-.7 0-1.1 1-1.1 2.8v18c0 1.2-.4 2-1 2.8-.7.7-1.5 1-2.6 1Z"
            />
          </g>
        )}
      </svg>
    </>
  );
}

export default Logo;
