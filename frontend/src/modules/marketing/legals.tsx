import { config } from 'config';
import { useTranslation } from 'react-i18next';
import { AsideAnchor } from '~/modules/common/aside-anchor';
import { PageAside } from '~/modules/common/page-aside';
import { SimpleHeader } from '~/modules/common/simple-header';
import StickyBox from '~/modules/common/sticky-box';
import PublicPage from '~/modules/marketing/page';

type LegalTypes = 'privacy' | 'terms';

export const LegalText = ({ textFor }: { textFor: LegalTypes }) => {
  if (textFor === 'terms') return <p className="mb-24">Put terms here</p>;
  return <p className="mb-24">Put privacy statement here</p>;
};

const Legal = ({ type }: { type: LegalTypes }) => {
  return (
    <section className="py-16 bg-background">
      <div className="mx-auto max-w-[48rem] font-light px-4 md:px-8 min-h-screen">
        <LegalText textFor={type} />
      </div>
    </section>
  );
};

const tabs = [
  { id: 'privacy', label: 'common:privacy_policy' },
  { id: 'terms', label: 'common:terms_of_use' },
] as const;

export const LegalsMenu = () => {
  const { t } = useTranslation();
  return (
    <PublicPage title={t('common:legal')}>
      <div className="container md:flex md:flex-row mt-4 md:mt-8 mx-auto gap-4">
        <div className="mx-auto md:min-w-48 md:w-[30%] md:mt-2">
          <StickyBox className="z-10 max-md:!block">
            <SimpleHeader className="p-3" text={t('common:legal_text', { appName: config.name })} />
            <PageAside tabs={tabs} className="py-2" />
          </StickyBox>
        </div>
        <div className="md:w-[70%] flex flex-col gap-8">
          {tabs.map((tab) => {
            return (
              <AsideAnchor key={tab.id} id={tab.id}>
                <Legal type={tab.id} />
              </AsideAnchor>
            );
          })}
        </div>
      </div>
    </PublicPage>
  );
};
