import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  type AlertColor,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, ThemeProvider } from '@mui/material/styles'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RefreshIcon from '@mui/icons-material/Refresh'
import TranslateIcon from '@mui/icons-material/Translate'
import { api, getErrorMessage } from './api'
import { portalConfig } from './config'
import { copy, displayState, formatTimestamp, languageOptions, type UiCopy } from './i18n'
import { initialLanguage, initialThemeMode, persistLanguage, persistThemeMode } from './storage'
import { createGatewayTheme, logoStyle } from './theme'
import type { GatewayState, Language, ParticipantDetails, SetupStep, SetupStepState, ThemeMode } from './types'

type Message = { tone: 'ok' | 'info' | 'error'; text: string }

export function App() {
  const [state, setState] = useState<GatewayState | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [language, setLanguage] = useState<Language>(() => initialLanguage())
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => initialThemeMode())
  const [message, setMessage] = useState<Message | null>(null)
  const t = copy[language]
  const { theme, logo } = useMemo(() => createGatewayTheme(themeMode), [themeMode])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    persistThemeMode(themeMode)
  }, [themeMode])

  useEffect(() => {
    document.documentElement.lang = language
    persistLanguage(language)
  }, [language])

  const refreshState = useCallback(
    async (showMessage = true) => {
      setBusy((current) => current || 'state')
      try {
        const next = await api<GatewayState>('/api/onboarding/state')
        setState(next)
        if (showMessage) {
          setMessage({
            tone: next.onboarded ? 'ok' : 'info',
            text: next.onboarded ? t.portalOpening : t.statusRefreshed,
          })
        }
        if (next.onboarded) window.setTimeout(() => window.location.assign('/'), 600)
      } catch (error) {
        setMessage({ tone: 'error', text: getErrorMessage(error) })
      } finally {
        setBusy('')
      }
    },
    [t],
  )

  useEffect(() => {
    refreshState(false)
    const interval = window.setInterval(() => {
      if (!document.hidden) refreshState(false)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [refreshState])

  async function sendRequest() {
    if (!state) return
    setBusy('case')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/cases', {
        method: 'POST',
        body: state.defaults,
      })
      setState(next)
      setMessage({ tone: 'ok', text: t.onboardingRequestSent })
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function retryCredentialSetup() {
    setBusy('credentials')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/credentials/request', { method: 'POST' })
      setState(next)
      setMessage({ tone: 'ok', text: t.credentialSetupRetried })
      await refreshState(false)
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  const isBusy = Boolean(busy)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={(muiTheme) => ({
          minHeight: '100vh',
          bgcolor: 'background.default',
          backgroundImage: `linear-gradient(90deg, ${alpha(muiTheme.palette.primary.main, 0.07)}, transparent 42%)`,
        })}
      >
        <TopBar
          language={language}
          logo={logo}
          themeMode={themeMode}
          title={portalConfig.title || t.portal}
          onLanguageChange={setLanguage}
          onRefresh={() => refreshState()}
          onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          refreshLabel={t.refresh}
          themeLabel={t.toggleTheme}
          portalLogoLabel={t.portalLogo}
          disabled={isBusy}
        />

        {!state ? (
          <Container maxWidth="lg" sx={{ py: 3 }}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <CircularProgress size={20} />
                <Typography>{t.loading}</Typography>
              </Stack>
            </Paper>
          </Container>
        ) : (
          <GatewayContent
            canRetryCredentials={Boolean(state.caseId && isApproved(state) && !state.onboarded && state.lastError)}
            isBusy={isBusy}
            language={language}
            message={message}
            state={state}
            t={t}
            onRefresh={() => refreshState()}
            onRetryCredentialSetup={retryCredentialSetup}
            onSendRequest={sendRequest}
          />
        )}
      </Box>
    </ThemeProvider>
  )
}

function TopBar(props: {
  language: Language
  logo?: { src?: string; alt?: string; sx?: { height?: number | string; width?: number | string } }
  themeMode: ThemeMode
  title: string
  onLanguageChange: (language: Language) => void
  onRefresh: () => void
  onToggleTheme: () => void
  refreshLabel: string
  themeLabel: string
  portalLogoLabel: string
  disabled: boolean
}) {
  return (
    <AppBar position="static" color="secondary" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters variant="dense" sx={{ gap: 2, minHeight: { xs: 56, sm: 50 }, py: 0.75 }}>
          {props.logo?.src && (
            <Box
              component="img"
              src={props.logo.src}
              alt={props.logo.alt || props.title || props.portalLogoLabel}
              sx={{ display: 'block', maxHeight: 40, maxWidth: 160, objectFit: 'contain', ...logoStyle(props.logo.sx) }}
            />
          )}
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1, fontWeight: 800 }}>
            {props.title}
          </Typography>
          <LocaleMenuButton language={props.language} onChange={props.onLanguageChange} />
          <Tooltip title={props.themeLabel} enterDelay={300}>
            <IconButton color="inherit" aria-label={props.themeLabel} onClick={props.onToggleTheme}>
              {props.themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={props.refreshLabel} enterDelay={300}>
            <span>
              <IconButton
                color="inherit"
                aria-label={props.refreshLabel}
                onClick={props.onRefresh}
                disabled={props.disabled}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </Container>
    </AppBar>
  )
}

function LocaleMenuButton(props: { language: Language; onChange: (language: Language) => void }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const current = languageOptions.find((option) => option.value === props.language) ?? languageOptions[0]

  return (
    <>
      <Button
        color="inherit"
        variant="text"
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        startIcon={<TranslateIcon />}
        endIcon={<ExpandMoreIcon fontSize="small" />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {current.label}
      </Button>
      <Menu id="language-menu" anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        {languageOptions.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === props.language}
            onClick={() => {
              props.onChange(option.value)
              setAnchorEl(null)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function GatewayContent(props: {
  canRetryCredentials: boolean
  isBusy: boolean
  language: Language
  message: Message | null
  state: GatewayState
  t: UiCopy
  onRefresh: () => void
  onRetryCredentialSetup: () => void
  onSendRequest: () => void
}) {
  const caseData = props.state.case
  const details = buildParticipantDetails(props.state)
  const setupSteps = buildSetupSteps(props.state, props.t)

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2.4}>
        <Hero language={props.language} state={props.state} t={props.t} />

        {props.message && <Alert severity={messageSeverity(props.message.tone)}>{props.message.text}</Alert>}
        {props.state.lastError && <Alert severity="error">{props.state.lastError}</Alert>}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(320px, 0.9fr)' },
            gap: 1.6,
            alignItems: 'start',
          }}
        >
          <ParticipantPanel
            canRetryCredentials={props.canRetryCredentials}
            details={details}
            isBusy={props.isBusy}
            state={props.state}
            t={props.t}
            onRefresh={props.onRefresh}
            onRetryCredentialSetup={props.onRetryCredentialSetup}
            onSendRequest={props.onSendRequest}
          />
          <ProgressPanel
            caseData={caseData}
            language={props.language}
            state={props.state}
            steps={setupSteps}
            t={props.t}
          />
        </Box>

        <TechnicalPanel caseData={caseData} language={props.language} state={props.state} t={props.t} />
      </Stack>
    </Container>
  )
}

function Hero(props: { language: Language; state: GatewayState; t: UiCopy }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', md: 'center' } }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
          {props.t.participantAccess}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: 0 }}>
          {props.state.onboarded ? props.t.readyForPortal : props.t.settingUpAccess}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 690 }}>
          {statusDescription(props.state, props.t)}
        </Typography>
      </Box>
      <StatusChip language={props.language} state={props.state} />
    </Stack>
  )
}

function ParticipantPanel(props: {
  canRetryCredentials: boolean
  details: ParticipantDetails
  isBusy: boolean
  state: GatewayState
  t: UiCopy
  onRefresh: () => void
  onRetryCredentialSetup: () => void
  onSendRequest: () => void
}) {
  return (
    <Paper component="section" elevation={1} sx={{ p: 2 }}>
      <Stack spacing={1.6}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {props.t.configuredParticipant}
          </Typography>
          <Typography color="text.secondary">{props.t.valuesFromConfig}</Typography>
        </Box>

        <InfoGrid>
          <Info label={props.t.organization} value={props.details.organizationName} />
          <Info label={props.t.contactEmail} value={props.details.contactEmail} />
          <Info label={props.t.requestedBpn} value={props.details.requestedBpn} mono />
          <Info label={props.t.requestedRole} value={props.details.requestedRole} />
        </InfoGrid>

        <Accordion
          disableGutters
          elevation={0}
          sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0 }}>
            <Typography color="primary" sx={{ fontWeight: 800 }}>
              {props.t.technicalConnectionDetails}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0 }}>
            <InfoGrid>
              <Info label={props.t.did} value={props.details.did} mono />
              <Info label={props.t.dspEndpoint} value={props.details.dspEndpoint} />
              <Info label={props.t.credentialService} value={props.details.identityHubCredentialServiceEndpoint} />
            </InfoGrid>
          </AccordionDetails>
        </Accordion>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {!props.state.caseId && (
            <Button onClick={props.onSendRequest} disabled={props.isBusy}>
              {props.state.autoSubmit ? props.t.retryRequest : props.t.sendRequest}
            </Button>
          )}
          {props.state.caseId && !props.state.onboarded && (
            <Button onClick={props.onRefresh} disabled={props.isBusy}>
              {props.t.checkNow}
            </Button>
          )}
          {props.canRetryCredentials && (
            <Button onClick={props.onRetryCredentialSetup} disabled={props.isBusy}>
              {props.t.retryCredentialSetup}
            </Button>
          )}
          <Button color="inherit" onClick={props.onRefresh} disabled={props.isBusy}>
            {props.t.refreshStatus}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function ProgressPanel(props: {
  caseData: GatewayState['case']
  language: Language
  state: GatewayState
  steps: SetupStep[]
  t: UiCopy
}) {
  return (
    <Paper component="aside" elevation={1} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {props.t.setupProgress}
        </Typography>
        <List disablePadding>
          {props.steps.map((step) => (
            <ListItem key={step.label} disableGutters alignItems="flex-start" sx={{ py: 0.7 }}>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                <StepIcon state={step.state} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontWeight: 800 }}>{step.label}</Typography>}
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    {step.detail}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
        <Divider />
        <Info
          label={props.t.operatorState}
          value={displayState(props.caseData?.state || props.state.state, props.language)}
        />
        <Info
          label={props.t.assignedBpn}
          value={props.caseData?.assignedBpn || props.caseData?.bpn || props.t.pending}
          mono
        />
        <Info label={props.t.updated} value={formatTimestamp(props.state.updatedAt, props.language)} />
      </Stack>
    </Paper>
  )
}

function TechnicalPanel(props: { caseData: GatewayState['case']; language: Language; state: GatewayState; t: UiCopy }) {
  return (
    <Accordion component={Paper} elevation={1} disableGutters sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography color="primary" sx={{ fontWeight: 800 }}>
          {props.t.technicalDetails}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.6}>
          <InfoGrid>
            <Info label={props.t.case} value={props.state.caseId || props.t.noCase} mono />
            <Info label={props.t.credentialRecords} value={String(props.state.credentials.length)} />
          </InfoGrid>

          {(props.caseData?.setupChecks || []).length > 0 && (
            <Stack divider={<Divider />} spacing={1}>
              {(props.caseData?.setupChecks || []).map((check) => (
                <Box key={check.name}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Typography>{check.name}</Typography>
                    <Typography sx={{ fontWeight: 800 }}>{displayState(check.status, props.language)}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {check.message}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}

          {props.state.credentials.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{props.t.type}</TableCell>
                  <TableCell>{props.t.issuer}</TableCell>
                  <TableCell>{props.t.operatorState}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.state.credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell>{credential.type}</TableCell>
                    <TableCell>{credential.issuer || '-'}</TableCell>
                    <TableCell>{displayState(credential.state || '-', props.language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

function InfoGrid(props: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.4 }}>
      {props.children}
    </Box>
  )
}

function Info(props: { label: string; value: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>
        {props.label}
      </Typography>
      <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere', fontFamily: props.mono ? 'monospace' : undefined }}>
        {props.value || '-'}
      </Typography>
    </Box>
  )
}

function StatusChip(props: { state: GatewayState; language: Language }) {
  const color = props.state.onboarded ? 'success' : props.state.caseId ? 'warning' : 'info'
  return (
    <Chip
      color={color}
      variant="outlined"
      label={displayState(props.state.onboarded ? 'ACTIVE' : props.state.state, props.language)}
      sx={{ minWidth: 150, fontWeight: 800 }}
    />
  )
}

function StepIcon(props: { state: SetupStepState }) {
  if (props.state === 'done') return <CheckCircleIcon color="success" />
  if (props.state === 'active') return <RadioButtonCheckedIcon color="primary" />
  return <RadioButtonUncheckedIcon color="disabled" />
}

function buildParticipantDetails(state: GatewayState): ParticipantDetails {
  const caseData = state.case ?? {}
  const defaults = state.defaults
  return {
    organizationName: caseData.organizationName || defaults.organizationName,
    requestedBpn: caseData.requestedBpn || defaults.requestedBpn,
    did: caseData.did || defaults.did,
    dspEndpoint: caseData.dspEndpoint || defaults.dspEndpoint,
    identityHubCredentialServiceEndpoint:
      caseData.identityHubCredentialServiceEndpoint || defaults.identityHubCredentialServiceEndpoint,
    contactEmail: caseData.contactEmail || defaults.contactEmail,
    requestedRole: caseData.requestedRole || defaults.requestedRole,
  }
}

function buildSetupSteps(state: GatewayState, t: UiCopy): SetupStep[] {
  const requestDone = Boolean(state.caseId)
  const approved = isApproved(state)
  const accessDone = state.onboarded

  return [
    {
      label: t.requestSent,
      detail: requestDone ? t.submittedMetadata : state.autoSubmit ? t.submittingMetadata : t.autoSubmissionDisabled,
      state: requestDone ? 'done' : 'active',
    },
    {
      label: t.operatorApproval,
      detail: approved ? t.operatorApproved : t.waitingForOperator,
      state: approved ? 'done' : requestDone ? 'active' : 'waiting',
    },
    {
      label: t.credentialsAndAccess,
      detail: accessDone ? t.credentialsIssued : approved ? t.requestingCredentials : t.credentialSetupAutomatic,
      state: accessDone ? 'done' : approved ? 'active' : 'waiting',
    },
  ]
}

function isApproved(state: GatewayState) {
  const caseState = state.case?.state || state.state || ''
  return (
    ['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE', 'ONBOARDED'].includes(caseState) || state.onboarded
  )
}

function statusDescription(state: GatewayState, t: UiCopy) {
  if (state.onboarded) return t.readyStatus
  if (!state.caseId && !state.autoSubmit) return t.requestSubmissionDisabledStatus
  if (!state.caseId) return t.requestSubmissionStatus
  if (isApproved(state)) return t.operatorApprovedStatus
  return t.waitingForOperatorStatus
}

function messageSeverity(tone: Message['tone']): AlertColor {
  if (tone === 'ok') return 'success'
  if (tone === 'error') return 'error'
  return 'info'
}
