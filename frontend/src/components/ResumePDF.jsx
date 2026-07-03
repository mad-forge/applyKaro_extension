import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 34,
    paddingBottom: 36,
    paddingHorizontal: 44,
    fontFamily: 'Times-Roman',
    color: '#111111',
    fontSize: 10,
    lineHeight: 1.35,
  },
  header: {
    marginBottom: 12,
    textAlign: 'center',
  },
  name: {
    marginBottom: 3,
    color: '#000000',
    fontFamily: 'Times-Bold',
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  contact: {
    color: '#333333',
    fontSize: 9,
    lineHeight: 1.5,
  },
  section: {
    marginTop: 9,
    marginBottom: 2,
  },
  heading: {
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.9,
    borderBottomColor: '#000000',
    color: '#000000',
    fontFamily: 'Times-Bold',
    fontSize: 11.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.42,
    color: '#1a1a1a',
    textAlign: 'justify',
  },
  skillGroupRow: {
    flexDirection: 'row',
    marginBottom: 2.5,
  },
  skillGroupLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    color: '#000000',
  },
  skillGroupValue: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  skills: {
    fontSize: 10,
    lineHeight: 1.45,
    color: '#1a1a1a',
  },
  item: {
    marginBottom: 7,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  itemTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 10.5,
    color: '#000000',
  },
  itemSubtitle: {
    marginTop: 0.5,
    marginBottom: 2,
    fontFamily: 'Times-Italic',
    color: '#222222',
    fontSize: 10,
  },
  duration: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'Times-Bold',
    color: '#333333',
    fontSize: 9.5,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 1.5,
    paddingLeft: 6,
  },
  bulletMarker: {
    width: 10,
    fontSize: 10,
    color: '#000000',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.38,
    color: '#1a1a1a',
    textAlign: 'justify',
  },
  educationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  educationMain: {
    flexGrow: 1,
    flexShrink: 1,
  },
  educationDegree: {
    fontFamily: 'Times-Bold',
    fontSize: 10.5,
    color: '#000000',
  },
  educationInst: {
    marginTop: 0.5,
    fontFamily: 'Times-Italic',
    fontSize: 10,
    color: '#222222',
  },
  additionalRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  additionalLabel: {
    width: 105,
    fontFamily: 'Times-Bold',
    fontSize: 10,
    color: '#000000',
  },
  additionalValue: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  pageNumber: {
    position: 'absolute',
    right: 44,
    bottom: 20,
    color: '#888888',
    fontSize: 8,
  },
})

const formatContact = (contactStr) => {
  if (!contactStr) return ''
  return contactStr.split('\n').filter(Boolean).join('  |  ')
}

const Bullets = ({ bullets }) => (
  <>
    {bullets.map((bullet, index) => (
      <View key={`${bullet}-${index}`} style={styles.bullet}>
        <Text style={styles.bulletMarker}>•</Text>
        <Text style={styles.bulletText}>{bullet}</Text>
      </View>
    ))}
  </>
)

// The section heading rides inside the first item's unbreakable block so it
// can never be orphaned at the bottom of a page.
const ItemsSection = ({ title, items }) => (
  <View style={styles.section}>
    {items.map((item, index) => (
      <View key={`${item.title}-${index}`} wrap={false}>
        {index === 0 && <Text style={styles.heading}>{title}</Text>}
        <View style={styles.item}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
          </View>
          {item.organization && <Text style={styles.itemSubtitle}>{item.organization}</Text>}
          <Bullets bullets={item.bullets || []} />
        </View>
      </View>
    ))}
  </View>
)

const Skills = ({ data }) => {
  if (data.skillGroups?.length > 0) {
    return (
      <>
        {data.skillGroups.map((group, index) => (
          <View key={`${group.label}-${index}`} style={styles.skillGroupRow}>
            <Text style={styles.skillGroupValue}>
              <Text style={styles.skillGroupLabel}>{group.label.replace(/:$/, '')}: </Text>
              {group.skills.join(', ')}
            </Text>
          </View>
        ))}
      </>
    )
  }
  return <Text style={styles.skills}>{data.skills.join(' • ')}</Text>
}

export const ResumePDF = ({ data }) => (
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

      {(data.skillGroups?.length > 0 || data.skills?.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.heading}>Technical Skills</Text>
          <Skills data={data} />
        </View>
      )}

      {data.experience?.length > 0 && (
        <ItemsSection title="Professional Experience" items={data.experience} />
      )}

      {data.projects?.length > 0 && (
        <ItemsSection title="Projects" items={data.projects} />
      )}

      {data.education?.length > 0 && (
        <View style={styles.section}>
          {data.education.map((item, index) => (
            <View key={`${item.institution}-${index}`} wrap={false}>
              {index === 0 && <Text style={styles.heading}>Education</Text>}
              <View style={styles.educationRow}>
                <View style={styles.educationMain}>
                  <Text style={styles.educationDegree}>{item.degree}</Text>
                  <Text style={styles.educationInst}>{item.institution}</Text>
                </View>
                {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {data.additionalInformation?.length > 0 && (
        <View style={styles.section}>
          {data.additionalInformation.map((item, index) => (
            <View key={`${item.label}-${index}`} wrap={false}>
              {index === 0 && <Text style={styles.heading}>Additional Information</Text>}
              <View style={styles.additionalRow}>
                <Text style={styles.additionalLabel}>{item.label}</Text>
                <Text style={styles.additionalValue}>{item.value}</Text>
              </View>
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
)
