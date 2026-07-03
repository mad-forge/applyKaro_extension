import { Document, Font, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import cmuRegular from '../assets/fonts/cmunrm.ttf'
import cmuBold from '../assets/fonts/cmunbx.ttf'
import cmuItalic from '../assets/fonts/cmunti.ttf'
import cmuBoldItalic from '../assets/fonts/cmunbi.ttf'

// Computer Modern (CMU Serif) — the classic LaTeX typeface.
Font.register({
  family: 'CMU Serif',
  fonts: [
    { src: cmuRegular },
    { src: cmuBold, fontWeight: 'bold' },
    { src: cmuItalic, fontStyle: 'italic' },
    { src: cmuBoldItalic, fontWeight: 'bold', fontStyle: 'italic' },
  ],
})

// No hyphenation: broken URLs/emails and stray hyphens hurt both looks
// and ATS text extraction. Lines still justify via word spacing.
Font.registerHyphenationCallback((word) => [word])

// Layout mirrors the reference LaTeX template: a4paper, 10pt,
// margins top/bottom 0.3in left/right 0.4in, tight list spacing, and
// content that flows freely instead of jumping whole blocks to the
// next page.
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 29,
    fontFamily: 'CMU Serif',
    color: '#000000',
    fontSize: 10,
    lineHeight: 1.25,
  },
  header: {
    marginBottom: 4,
    textAlign: 'center',
  },
  name: {
    marginBottom: 2,
    fontFamily: 'CMU Serif', fontWeight: 'bold',
    fontSize: 25,
    lineHeight: 1.05,
  },
  contact: {
    fontSize: 9.5,
    lineHeight: 1.35,
  },
  contactLabel: {
    fontFamily: 'CMU Serif',
    fontWeight: 'bold',
  },
  section: {
    marginTop: 5,
  },
  heading: {
    marginBottom: 3,
    paddingBottom: 1.5,
    borderBottomWidth: 0.8,
    borderBottomColor: '#000000',
    fontFamily: 'CMU Serif', fontWeight: 'bold',
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
    fontFamily: 'CMU Serif', fontWeight: 'bold',
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
    fontFamily: 'CMU Serif', fontWeight: 'bold',
    fontSize: 10.5,
  },
  itemSubtitle: {
    marginBottom: 1,
    fontFamily: 'CMU Serif', fontStyle: 'italic',
    fontSize: 10,
  },
  duration: {
    flexShrink: 0,
    paddingLeft: 10,
    fontFamily: 'CMU Serif', fontWeight: 'bold',
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
    fontFamily: 'CMU Serif', fontWeight: 'bold',
    fontSize: 10.5,
  },
  educationInst: {
    fontFamily: 'CMU Serif', fontStyle: 'italic',
    fontSize: 10,
  },
})

// Renders "Label: value" contact segments with bold labels, joined by pipes.
// Children stay flat (strings + bold label Texts) so line breaking still
// happens at spaces; nesting whole segments makes them unbreakable chunks.
const ContactLine = ({ contact }) => {
  const segments = (contact || '')
    .split(/\n|\|/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const children = []
  segments.forEach((segment, index) => {
    if (index > 0) children.push(' | ')
    const labeled = segment.match(/^([A-Za-z][A-Za-z ]{1,24}):\s*(.+)$/)
    if (labeled) {
      children.push(
        <Text key={`label-${segment}-${index}`} style={styles.contactLabel}>{labeled[1]}: </Text>,
        labeled[2],
      )
    } else {
      children.push(segment)
    }
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
