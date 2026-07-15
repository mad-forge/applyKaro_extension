import { Document, Font, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// No hyphenation: broken URLs/emails and stray hyphens hurt both looks
// and ATS text extraction. Lines still justify via word spacing.
Font.registerHyphenationCallback((word) => [word])

// Mirrors a modern Helvetica + navy-blue LaTeX resume: two-column header
// (name/title left, contact right-aligned), Large bold navy section
// headings with a navy rule, and a two-row experience block (title+duration,
// then italic navy company + location). 'Helvetica' is one of the 14
// standard PDF fonts react-pdf ships with normal/bold/italic pre-registered.
const NAVY = '#143C6E'
const DARK_TEXT = '#323232'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 25,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    color: DARK_TEXT,
    fontSize: 10,
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '58%',
  },
  name: {
    fontFamily: 'Helvetica', fontWeight: 'bold',
    color: NAVY,
    fontSize: 24,
    lineHeight: 1.05,
  },
  title: {
    marginTop: 2,
    fontSize: 12,
    color: DARK_TEXT,
  },
  contactBlock: {
    flexDirection: 'column',
    flexShrink: 0,
    width: '40%',
    alignItems: 'flex-end',
  },
  contactLine: {
    fontSize: 9,
    lineHeight: 1.5,
    textAlign: 'right',
  },
  contactLink: {
    color: NAVY,
  },
  section: {
    marginTop: 7,
  },
  heading: {
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: NAVY,
    fontFamily: 'Helvetica', fontWeight: 'bold',
    color: NAVY,
    fontSize: 13,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.35,
    textAlign: 'justify',
  },
  skillGroupRow: {
    marginBottom: 1.5,
  },
  skillGroupValue: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  skillGroupLabel: {
    fontFamily: 'Helvetica', fontWeight: 'bold',
  },
  skills: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  item: {
    marginBottom: 6,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  itemTitle: {
    fontFamily: 'Helvetica', fontWeight: 'bold',
    fontSize: 10.5,
  },
  itemOrganization: {
    fontFamily: 'Helvetica', fontStyle: 'italic',
    color: NAVY,
    fontSize: 10,
  },
  duration: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'Helvetica', fontWeight: 'bold',
    fontSize: 9.5,
  },
  location: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'Helvetica', fontStyle: 'italic',
    color: '#6b7280',
    fontSize: 9.5,
  },
  bullet: {
    flexDirection: 'row',
    marginTop: 2,
    paddingLeft: 5,
  },
  bulletMarker: {
    width: 9,
    fontSize: 9.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.35,
    textAlign: 'justify',
  },
  educationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  educationBlock: {
    marginBottom: 4,
  },
  educationDegree: {
    fontFamily: 'Helvetica', fontWeight: 'bold',
    fontSize: 10.5,
  },
  educationInst: {
    fontFamily: 'Helvetica', fontStyle: 'italic',
    color: NAVY,
    fontSize: 10,
  },
})

// Contact segments are stacked one per line, right-aligned — an adaptation
// of the reference's fixed 4-line block that stays correct no matter how
// many contact fields a given resume actually has.
const ContactBlock = ({ contact }) => {
  const segments = (contact || '')
    .split(/\n|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  return (
    <View style={styles.contactBlock}>
      {segments.map((segment, index) => {
        const labeled = segment.match(/^([A-Za-z][A-Za-z ]{1,24}):\s*(.+)$/)
        const isLinky = /@|\.[a-z]{2,}|github|linkedin/i.test(segment)
        return (
          <Text key={`${segment}-${index}`} style={[styles.contactLine, isLinky && styles.contactLink]}>
            {labeled ? `${labeled[1]}: ${labeled[2]}` : segment}
          </Text>
        )
      })}
    </View>
  )
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

// The heading rides with the first item's header rows (never the bullets)
// so it can't be orphaned at a page break without dragging the section along.
const ItemsSection = ({ title, items }) => (
  <View style={styles.section}>
    {items.map((item, index) => (
      <View key={`${item.title}-${index}`} style={styles.item}>
        <View wrap={false}>
          {index === 0 && <Text style={styles.heading}>{title}</Text>}
          <View style={styles.itemHeaderRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
          </View>
          {item.organization && (
            <View style={styles.itemHeaderRow}>
              <Text style={styles.itemOrganization}>{item.organization}</Text>
            </View>
          )}
        </View>
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

const AdditionalSection = ({ item }) => {
  const parts = item.value.split(/\n|(?=•)/).map((part) => part.replace(/^[•\s]+/, '').trim()).filter(Boolean)
  if (parts.length > 1) {
    return (
      <View style={styles.section}>
        <View wrap={false}>
          <Text style={styles.heading}>{item.label}</Text>
          <Bullets bullets={parts.slice(0, 1)} />
        </View>
        <Bullets bullets={parts.slice(1)} />
      </View>
    )
  }
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.heading}>{item.label}</Text>
        <Text style={styles.paragraph}>{parts[0] || item.value}</Text>
      </View>
    </View>
  )
}

export const ModernNavyTemplate = ({ data }) => (
  <Document title={`${data.name || 'Candidate'} - Tailored Resume`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{data.name || 'Candidate Name'}</Text>
          {data.experience?.[0]?.title && <Text style={styles.title}>{data.experience[0].title}</Text>}
        </View>
        <ContactBlock contact={data.contact} />
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
          {data.education.map((item, index) => (
            <View key={`${item.institution}-${index}`} style={styles.educationBlock} wrap={false}>
              {index === 0 && <Text style={styles.heading}>Education</Text>}
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
