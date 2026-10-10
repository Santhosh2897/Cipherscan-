export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
];

export type TranslationKey =
  // Brand & Nav
  | 'brand_name'
  | 'nav_dashboard'
  | 'nav_analyzer'
  | 'nav_history'
  | 'nav_threat_intel'
  | 'intel_section'
  | 'agent_active'
  | 'scope'
  | 'fleet_view'
  | 'device_scope'
  | 'all_endpoints_aggregated'
  | 'switch_to_fleet'
  | 'language'
  | 'select_language'
  
  // Verdicts & Status
  | 'verdict_safe'
  | 'verdict_suspicious'
  | 'verdict_malicious'
  | 'risk_score'
  | 'status_active'
  | 'gathering_intel'
  | 'running_diagnostics'
  
  // Login
  | 'login_title'
  | 'login_subtitle'
  | 'tab_device_user'
  | 'tab_admin'
  | 'enter_device_id'
  | 'device_id_placeholder'
  | 'enter_pin'
  | 'pin_description'
  | 'authenticating'
  | 'authenticate_btn'
  | 'dev_mode_hint'
  | 'invalid_pin'
  
  // Dashboard
  | 'command_center'
  | 'device_defense_center'
  | 'fleet_subtitle'
  | 'device_subtitle'
  | 'refresh'
  | 'reset_data'
  | 'total_scans'
  | 'threats_detected'
  | 'clean_links'
  | 'suspicious_links'
  | 'recent_scans'
  | 'view_all'
  | 'no_scans_yet'
  | 'threat_breakdown'
  | 'scan_activity'
  | 'community_threat_stats'
  | 'threats_blocked_today'
  | 'active_protected_devices'
  | 'session_expired'
  | 'session_expired_desc'
  | 'reauthenticate'
  | 'web_dashboard'
  | 'qr_camera'
  | 'android_mobile'
  | 'admin_badge'
  
  // Analyzer
  | 'deep_scan_title'
  | 'deep_scan_subtitle'
  | 'url_placeholder'
  | 'scan_button'
  | 'analyzing_button'
  | 'analysis_results'
  | 'threat_indicators'
  | 'redirect_chain'
  | 'screenshot_preview'
  
  // History
  | 'scan_history_title'
  | 'scan_history_subtitle'
  | 'search_placeholder'
  | 'filter_all'
  | 'filter_safe'
  | 'filter_suspicious'
  | 'filter_malicious'
  | 'clear_history'
  | 'table_url'
  | 'table_verdict'
  | 'table_score'
  | 'table_source'
  | 'table_time'
  | 'table_action'
  | 'no_records_found'
  
  // Threat Intel
  | 'threat_intel_title'
  | 'threat_intel_subtitle'
  | 'trending_threats'
  | 'top_flagged_domains'
  | 'trust_domain'
  | 'block_domain';
