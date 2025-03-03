import { type Language, config } from 'config';
import { useTranslation } from 'react-i18next';
import { i18n } from '~/lib/i18n';
import CountryFlag from '~/modules/common/country-flag';
import { toaster } from '~/modules/common/toaster';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { updateSelf } from '~/modules/users/api';
import { useUserStore } from '~/store/user';

interface Props {
  size?: number;
  align?: 'start' | 'end';
  className?: string;
}

const UserLanguage = ({ align = 'end', className = '' }: Props) => {
  const { t } = useTranslation();

  const { user, updateUser } = useUserStore();
  const language = i18n.resolvedLanguage || i18n.language;

  const changeLanguage = (lng: Language) => {
    if (!user) return;
    updateSelf({ language: lng }).then((res) => {
      updateUser(res);
    });
    if (window.Gleap) window.Gleap.setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Change language">
          <span className="font-light">{language.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        {config.languages.map((lang) => (
          <DropdownMenuCheckboxItem
            key={lang}
            checked={language === lang}
            onCheckedChange={() => {
              if (lang === 'nl') toaster('NL (Dutch) language will be available upon release.', 'info');
              changeLanguage(lang);
            }}
          >
            <CountryFlag countryCode={lang} imgType="png" />
            <span className="ml-2">{t(`common:${lang}`)}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserLanguage;
