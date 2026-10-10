export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'ko';

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
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
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
  
  // Threat Intel & Community Widgets
  | 'threat_intel_title'
  | 'threat_intel_subtitle'
  | 'trending_threats'
  | 'top_flagged_domains'
  | 'trust_domain'
  | 'block_domain'
  | 'community_network_title'
  | 'urls_cached'
  | 'total_hits'
  | 'safe_urls'
  | 'community_verified'
  | 'malicious_cached'
  | 'flagged_by_intel'
  | 'threat_volume_7d'
  | 'threat_taxonomy'
  
  // ScanResultCard
  | 'original_target'
  | 'final_destination'
  | 'live_preview'
  | 'expand'
  | 'click_to_expand'
  | 'no_preview'
  | 'virustotal'
  | 'safe_browsing'
  | 'detections'
  | 'unscanned'
  | 'flagged'
  | 'clean'
  | 'close_preview'
  | 'unsafe_link_blocked'
  | 'full_feed'
  
  // ScanDetail
  | 'scan_num'
  | 'instant_cached'
  | 'trusted_domain'
  | 'trigger_label'
  | 'community_trust_score'
  | 'community_verified_safe'
  | 'low_community_confidence'
  | 'community_flagged_threat'
  | 'no_community_data'
  | 'users_scanned'
  | 'community_flags'
  | 'report_as'
  | 'report_submitted'
  | 'scan_from_android'
  
  // DeviceSelector & Admin Modal
  | 'fleet_overview_all'
  | 'admin_login'
  | 'elevate_admin_view'
  | 'admin_pin_desc'
  | 'enter_admin_pin'
  | 'cancel'
  | 'unlock_admin_view'
  | 'admin_device_scope'
  | 'switch_device'
  | 'custom_device_id'
  | 'device_view'
  | 'registered_devices'
  | 'no_active_devices'
  | 'filter_by_custom_device'
  | 'paste_device_uuid'
  | 'apply'
  | 'reset_to_fleet'
  | 'device_telemetry_active'
  | 'protected_endpoint'
  | 'scoped_admin_view'
  | 'displaying_scans_for'
  | 'verifying'
  
  // Dashboard & Intel Extended
  | 'live_badge'
  | 'reports_filed'
  | 'by_users_like_you'
  | 'trending_categories_24h'
  | 'live_feed_fleet'
  | 'live_feed_device'
  | 'score_label'
  | 'no_scans_dashboard_desc'
  | 'trending_threats_24h'
  | 'top_flagged_hashed'
  | 'privacy_protected'
  | 'my_domain_intelligence'
  | 'domains_tracked'
  | 'no_trending_threats_safe'
  | 'no_community_reports'
  | 'trusted'
  | 'no_domain_patterns'
  | 'scan_from_android_domain'
  
  // Charts & Secondary
  | 'no_taxonomy_yet'
  | 'count_label'
  | 'redirect_chain_hops'
  | 'hop_num'
  | 'detected_threats'
  | 'not_found_title'
  | 'not_found_desc'
  | 'return_to_command_center';

