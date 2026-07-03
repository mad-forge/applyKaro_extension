import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 35,
    paddingBottom: 35,
    paddingHorizontal: 45,
    fontFamily: 'Helvetica',
    color: '#111111',
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 15,
    textAlign: 'center',
  },
  name: {
    marginBottom: 4,
    color: '#000000',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 1.15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  contact: {
    color: '#555555',
    fontSize: 8.5,
    lineHeight: 1.5,
  },
  section: {
    marginTop: 10,
    marginBottom: 4,
  },
  heading: {
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: '#333333',
  },
  skills: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: '#333333',
  },
  item: {
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  itemHeaderMain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  itemTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  itemSubtitle: {
    color: '#444444',
    fontSize: 9.5,
    fontStyle: 'italic',
  },
  duration: {
    flexShrink: 0,
    color: '#666666',
    fontSize: 9,
    fontWeight: 'bold',
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 4,
  },
  bulletMarker: {
    width: 10,
    fontSize: 9.5,
    color: '#555555',
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: '#333333',
  },
  educationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  educationMain: {
    flexGrow: 1,
    flexShrink: 1,
  },
  educationDegree: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  educationInst: {
    fontSize: 9.5,
    color: '#444444',
    marginTop: 1,
  },
  additionalRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  additionalLabel: {
    width: 100,
    fontWeight: 'bold',
    fontSize: 9.5,
    color: '#000000',
  },
  additionalValue: {
    flex: 1,
    fontSize: 9.5,
    color: '#333333',
  },
  pageNumber: {
    position: 'absolute',
    right: 45,
    bottom: 20,
    color: '#999999',
    fontSize: 8,
  },
});

export interface ResumeItem {
  title: string;
  organization: string;
  duration: string;
  bullets: string[];
  sourceEvidence: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  duration: string;
  sourceEvidence: string;
}

export interface AdditionalItem {
  label: string;
  value: string;
  sourceEvidence: string;
}

export interface SkillGroup {
  label: string;
  skills: string[];
}

export interface ResumeData {
  name: string;
  contact: string;
  summary: string;
  skills: string[];
  skillGroups?: SkillGroup[];
  experience: ResumeItem[];
  projects: ResumeItem[];
  education: EducationItem[];
  additionalInformation: AdditionalItem[];
  addedKeywords: {
    keyword: string;
    location: string;
  }[];
}

const formatContact = (contactStr: string) => {
  if (!contactStr) return '';
  return contactStr.split('\n').filter(Boolean).join('  |  ');
};

const Bullets = ({ bullets }: { bullets: string[] }) => (
  <>
    {bullets.map((bullet, index) => (
      <View key={`${bullet}-${index}`} style={styles.bullet}>
        <Text style={styles.bulletMarker}>•</Text>
        <Text style={styles.bulletText}>{bullet}</Text>
      </View>
    ))}
  </>
);

const ResumeItems = ({ items }: { items: ResumeItem[] }) => (
  <>
    {items.map((item, index) => (
      <View key={`${item.title}-${index}`} style={styles.item} wrap={false}>
        <View style={styles.itemHeader}>
          <View style={styles.itemHeaderMain}>
            <Text style={styles.itemTitle}>
              {item.title}
              {item.organization ? <Text style={{ fontWeight: 'normal' }}> | </Text> : ''}
              {item.organization ? <Text style={styles.itemSubtitle}>{item.organization}</Text> : ''}
            </Text>
          </View>
          {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
        </View>
        <Bullets bullets={item.bullets || []} />
      </View>
    ))}
  </>
);

export const ResumePDF = ({ data }: { data: ResumeData }) => (
  <Document title={`${data.name || 'Candidate'} - Tailored Resume`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{data.name || 'Candidate Name'}</Text>
        <Text style={styles.contact}>{formatContact(data.contact)}</Text>
      </View>

      {data.summary && (
        <View style={styles.section}>
          <Text style={styles.heading}>Professional Summary</Text>
          <Text style={styles.paragraph}>{data.summary}</Text>
        </View>
      )}

      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading}>Technical Skills</Text>
          <Text style={styles.skills}>{data.skills.join(' • ')}</Text>
        </View>
      )}

      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={45}>Professional Experience</Text>
          <ResumeItems items={data.experience} />
        </View>
      )}

      {data.projects?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={45}>Projects</Text>
          <ResumeItems items={data.projects} />
        </View>
      )}

      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={35}>Education</Text>
          {data.education.map((item, index) => (
            <View key={`${item.institution}-${index}`} style={styles.educationRow} wrap={false}>
              <View style={styles.educationMain}>
                <Text style={styles.educationDegree}>{item.degree}</Text>
                <Text style={styles.educationInst}>{item.institution}</Text>
              </View>
              {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
            </View>
          ))}
        </View>
      )}

      {data.additionalInformation?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={30}>Additional Information</Text>
          {data.additionalInformation.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.additionalRow} wrap={false}>
              <Text style={styles.additionalLabel}>{item.label}</Text>
              <Text style={styles.additionalValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}

      <Text
        style={styles.pageNumber}
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </Page>
  </Document>
);
