import { Document, Font, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// No hyphenation: broken URLs/emails and stray hyphens hurt both looks
// and ATS text extraction. Lines still justify via word spacing.
Font.registerHyphenationCallback((word) => [word])

// Mirrors a centered, small-caps classic serif LaTeX resume (the reference
// uses tgpagella/Palatino; that font isn't one of the 14 standard PDF fonts
// react-pdf ships without bundling a font file, so this approximates it with
// the closest standard serif, 'Times-Roman'). Centered header with a
// small-caps name + italic subtitle, bold+uppercase ruled section headings,
// and "Title | Company" inline experience rows.
const DARK_TEXT = '#191919'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 29,
    fontFamily: 'Times-Roman',
    color: DARK_TEXT,
    fontSize: 10,
    lineHeight: 1.25,
  },
  header: {
    marginBottom: 4,
    textAlign: 'center',
  },
  name: {
    marginBottom: 1,
    fontFamily: 'Times-Roman', fontWeight: 'bold',
    fontSize: 24,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginBottom: 2,
    fontFamily: 'Times-Roman', fontStyle: 'italic',
    fontSize: 12,
  },
  contact: {
    fontSize: 9.5,
    lineHeight: 1.35,
    textAlign: 'center',
  },
  section: {
    marginTop: 4,
  },
  heading: {
    marginBottom: 3,
    paddingBottom: 1.5,
    borderBottomWidth: 0.8,
    borderBottomColor: '#000000',
    fontFamily: 'Times-Roman', fontWeight: 'bold',
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
    fontFamily: 'Times-Roman', fontWeight: 'bold',
  },
  skills: {
    fontSize: 10,
    lineHeight: 1.3,
  },
  item: {
    marginBottom: 4,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  itemTitleLine: {
    fontSize: 10.5,
  },
  itemTitle: {
    fontFamily: 'Times-Roman', fontWeight: 'bold',
  },
  itemOrganization: {
    fontFamily: 'Times-Roman', fontStyle: 'italic',
  },
  itemLocation: {
    marginBottom: 1,
    fontFamily: 'Times-Roman', fontStyle: 'italic',
    fontSize: 9.5,
  },
  duration: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'Times-Roman', fontWeight: 'bold',
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
  educationInst: {
    fontFamily: 'Times-Roman', fontWeight: 'bold',
    fontSize: 10.5,
  },
  educationDegreeLine: {
    fontFamily: 'Times-Roman', fontStyle: 'italic',
    fontSize: 10,
  },
})

// Renders "Label: value" contact segments centered, joined by pipes.
const ContactLine = ({ contact }) => {
  const segments = (contact || '')
    .split(/\n|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const children = []
  segments.forEach((segment, index) => {
    if (index > 0) children.push(' | ')
    children.push(segment)
  })

  return <Text style={styles.contact}>{children}</Text>
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

// "Title | Company" on one line with duration flushed right, then an italic
// location/organization sub-line — matches the reference's inline pipe
// header instead of the boxier title/company-on-separate-rows layout.
const ItemsSection = ({ title, items }) => (
  <View style={styles.section}>
    {items.map((item, index) => (
      <View key={`${item.title}-${index}`} style={styles.item}>
        <View wrap={false}>
          {index === 0 && <Text style={styles.heading}>{title}</Text>}
          <View style={styles.itemHeaderRow}>
            <Text style={styles.itemTitleLine}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.organization && (
                <>
                  {' | '}
                  <Text style={styles.itemOrganization}>{item.organization}</Text>
                </>
              )}
            </Text>
            {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
          </View>
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

export const PalatinoClassicTemplate = ({ data }) => (
  <Document title={`${data.name || 'Candidate'} - Tailored Resume`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{data.name || 'Candidate Name'}</Text>
        {data.experience?.[0]?.title && <Text style={styles.subtitle}>{data.experience[0].title}</Text>}
        <ContactLine contact={data.contact} />
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
                <Text style={styles.educationInst}>{item.institution}</Text>
                {item.duration && <Text style={styles.duration}>{item.duration}</Text>}
              </View>
              <Text style={styles.educationDegreeLine}>{item.degree}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  </Document>
)
