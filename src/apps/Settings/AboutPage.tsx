import { List, ListSection, ListRow } from '@/system';

export function AboutPage() {
  return (
    <div data-testid="about-page" className="h-full">
      <List>
        <ListSection>
          <ListRow title="名称" detail="hiPhone" chevron />
          <ListRow title="iOS 版本" detail="hiPhoneOS 1.0" />
          <ListRow title="型号名称" detail="Web Simulator" />
          <ListRow title="型号号码" detail="WEB-001" />
          <ListRow title="序列号" detail="HI2026APR08" />
          <ListRow title="构建版本" detail="2026.04.09-v2" isLast />
        </ListSection>
      </List>
    </div>
  );
}
