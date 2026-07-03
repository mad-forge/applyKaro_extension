import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Layout mirrors the reference LaTeX template: a4paper, 10pt Times,
// margins top/bottom 0.3in left/right 0.4in, tight list spacing, and
// content that flows freely instead of jumping whole blocks to the
// next page.
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 29,
    fontFamily: 'Times-Roman',
    color: '#000000',
    fontSize: 10,
    lineHeight: 1.25,
  },
  header: {
    marginBottom: 6,
    textAlign: 'center',
  },
  name: {
    marginBottom: 2,
    fontFamily: 'Times-Bold',
    fontSize: 25,
    lineHeight: 1.05,
  },
  contact: {
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  section: {
    marginTop: 6,
  },
  heading: {
    marginBottom: 3,
    paddingBottom: 1.5,
    borderBottomWidth: 0.8,
    borderBottomColor: '#000000',
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.3,
    textAlign: 'justify',
  },
  skillGroupRow: {
    marginBottom: 1,
  },
  skillGroupValue: {
    fontSize: 10,
    lineHeight: 1.3,
  },
  skillGroupLabel: {
    fontFamily: 'Times-Bold',
  },
  skills: {
    fontSize: 10,
    lineHeight: 1.3,
  },
  item: {
    marginBottom: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  itemTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 10.5,
  },
  itemSubtitle: {
    marginBottom: 1,
    fontFamily: 'Times-Italic',
    fontSize: 10,
  },
  duration: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'Times-Bold',
    fontSize: 10,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 0.5,
    paddingLeft: 5,
  },
  bulletMarker: {
    width: 9,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.28,
    textAlign: 'justify',
  },
  educationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  educationBlock: {
    marginBottom: 3,
  },
  educationDegree: {
    fontFamily: 'Times-Bold',
    fontSize: 10.5,
  },
  educationInst: {
    fontFamily: 'Times-Italic',
    fontSize: 10,
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

const ItemsSection = ({ title, items }) => (
  <View style={styles.section}>
    <Text style={styles.heading} minPresenceAhead={40}>{title}</Text>
    {items.map((item, index) => (
      <View key={`${item.title}-${index}`} style={styles.item}>
        <View style={styles.itemHeader} minPresenceAhead={30}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
        </View>
        {item.organization && <Text style={styles.itemSubtitle}>{item.organization}</Text>}
        <Bullets bullets={item.bullets || []} />
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

// Additional-info values often carry their own "•" bullets (e.g.
// certifications); render those as a proper list, otherwise as a
// labeled paragraph.
const AdditionalSection = ({ item }) => {
  const parts = item.value.split(/\n|(?=•)/).map((part) => part.replace(/^[•\s]+/, '').trim()).filter(Boolean)
  return (
    <View style={styles.section}>
      <Text style={styles.heading} minPresenceAhead={30}>{item.label}</Text>
      {parts.length > 1
        ? <Bullets bullets={parts} />
        : <Text style={styles.paragraph}>{parts[0] || item.value}</Text>}
    </View>
  )
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
          <Text style={styles.heading} minPresenceAhead={30}>Summary</Text>
          <Text style={styles.paragraph}>{data.summary}</Text>
        </View>
      )}

      {(data.skillGroups?.length > 0 || data.skills?.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={30}>Skills</Text>
          <Skills data={data} />
        </View>
      )}

      {data.experience?.length > 0 && (
        <ItemsSection title="Experience" items={data.experience} />
      )}

      {data.projects?.length > 0 && (
        <ItemsSection title="Projects" items={data.projects} />
      )}

      {data.additionalInformation?.map((item, index) => (
        <AdditionalSection key={`${item.label}-${index}`} item={item} />
      ))}

      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.heading} minPresenceAhead={40}>Education</Text>
          {data.education.map((item, index) => (
            <View key={`${item.institution}-${index}`} style={styles.educationBlock}>
              <View style={styles.educationRow}>
                <Text style={styles.educationDegree}>{item.degree}</Text>
                {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
              </View>
              <Text style={styles.educationInst}>{item.institution}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  </Document>
)
