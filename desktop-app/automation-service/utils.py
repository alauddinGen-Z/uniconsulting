"""
Automation Service Utilities

Provides utility functions for the automation agent, including:
- Zero Trust SafeLogger with PII redaction
- Cloudflare/DDoS protection detection
- Page accessibility checks
"""

import logging
import re
import os
from datetime import datetime
from typing import Dict, Optional, List, Tuple


# =============================================================================
#                         ZERO TRUST SAFE LOGGER
# =============================================================================

class SafeFormatter(logging.Formatter):
    """
    Custom logging Formatter that redacts Personally Identifiable Information (PII).
    
    Implements Zero Trust Data Policy by ensuring no PII is written to logs.
    Redacts: emails, phone numbers, and passport numbers.
    """
    
    # PII Redaction Patterns (compiled for performance)
    PATTERNS = [
        # Email addresses
        (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[REDACTED_EMAIL]'),
        # Phone numbers (handles dash, dot, space separators)
        (re.compile(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b'), '[REDACTED_PHONE]'),
        # Passport numbers (UniConsulting Standard: 2 uppercase letters + 7-9 digits)
        (re.compile(r'\b[A-Z]{2}\d{7,9}\b'), '[REDACTED_PASSPORT]'),
        # Credit card numbers (basic pattern)
        (re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'), '[REDACTED_CC]'),
        # SSN/National ID patterns
        (re.compile(r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b'), '[REDACTED_SSN]'),
    ]
    
    def _redact_pii(self, message: str) -> str:
        """Apply all PII redaction patterns to a message."""
        if not isinstance(message, str):
            message = str(message)
        
        for pattern, replacement in self.PATTERNS:
            message = pattern.sub(replacement, message)
        
        return message
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format the log record with PII redaction applied.
        
        Overrides the parent format() to ensure all PII is redacted
        before the log record is written to any handler.
        """
        # Redact the message before formatting
        if hasattr(record, 'msg') and record.msg:
            record.msg = self._redact_pii(str(record.msg))
        
        # Also redact args if present (for % formatting)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: self._redact_pii(str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    self._redact_pii(str(arg)) if isinstance(arg, str) else arg
                    for arg in record.args
                )
        
        # Call parent formatter
        formatted = super().format(record)
        
        # Final redaction pass on the complete formatted message
        return self._redact_pii(formatted)


def setup_safe_logging(
    log_file: Optional[str] = None,
    log_level: int = logging.INFO,
    log_format: str = '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    date_format: str = '%Y-%m-%d %H:%M:%S'
) -> logging.Logger:
    """
    Configure secure logging with PII redaction for the automation service.
    
    This function sets up a file handler and console handler, both using
    the SafeFormatter to ensure no PII is ever written to logs.
    
    Args:
        log_file: Path to the log file. Defaults to 'automation_service.log'
                  in the automation-service directory.
        log_level: Logging level (default: INFO)
        log_format: Log message format string
        date_format: Date format for log timestamps
        
    Returns:
        Configured logger instance with SafeFormatter applied.
        
    Example:
        >>> logger = setup_safe_logging()
        >>> logger.info("User john.doe@email.com logged in")
        # Logs: "User [REDACTED_EMAIL] logged in"
    """
    # Determine log file location
    if log_file is None:
        log_dir = os.path.dirname(os.path.abspath(__file__))
        log_file = os.path.join(log_dir, 'automation_service.log')
    
    # Create SafeFormatter instance
    safe_formatter = SafeFormatter(fmt=log_format, datefmt=date_format)
    
    # Get root logger for automation service
    logger = logging.getLogger('automation_service')
    logger.setLevel(log_level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # File Handler (with rotation-ready naming)
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(log_level)
    file_handler.setFormatter(safe_formatter)
    logger.addHandler(file_handler)
    
    # Console Handler (for development)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(safe_formatter)
    logger.addHandler(console_handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    logger.info("SafeLogger initialized with PII redaction enabled")
    
    return logger


def get_safe_logger(name: str = 'automation_service') -> logging.Logger:
    """
    Get a child logger that inherits SafeFormatter from parent.
    
    Args:
        name: Logger name (will be prefixed with 'automation_service.')
        
    Returns:
        Logger instance with PII redaction inherited.
    """
    return logging.getLogger(f'automation_service.{name}')


# =============================================================================
#                      CLOUDFLARE/DDoS PROTECTION DETECTION
# =============================================================================


def has_cloudflare_protection(status_code: int, headers: dict, html_content: str) -> bool:
    """
    Detects Cloudflare/DDoS protection based on status codes, headers, and page content flags.
    
    This function checks for common indicators that a page is blocked by Cloudflare
    or similar DDoS protection services. It should be called after every page load
    or HTTP request to verify if the page content is actually visible.
    
    Args:
        status_code: HTTP response status code (e.g., 200, 403, 503)
        headers: Dictionary of HTTP response headers
        html_content: The HTML content of the response body
        
    Returns:
        True if Cloudflare/DDoS protection is detected, False otherwise
        
    Example:
        >>> is_blocked = has_cloudflare_protection(
        ...     status_code=403,
        ...     headers={'Server': 'cloudflare'},
        ...     html_content='<html>Checking your browser...</html>'
        ... )
        >>> print(is_blocked)
        True
    """
    # Get server header, defaulting to empty string
    server_header = headers.get('Server', '').lower()
    
    # Cloudflare specific flags to look for in the HTML
    cloudflare_flags = [
        '403 Forbidden',
        'cloudflare',
        'Security check',
        'Please Wait... | Cloudflare',
        'We are checking your browser...',
        'Checking your browser before accessing',
        'This process is automatic.',
        'DDoS protection by',
        'Ray ID:',
        '_cf_chl',
        'cf-spinner-please-wait'
    ]

    # Primary check: Status 403/503 + Server header or Content Flags
    if status_code in [403, 503]:
        # Check if server header confirms cloudflare
        if 'cloudflare' in server_header:
            # Double check content for specific blocking messages
            for flag in cloudflare_flags:
                if flag in html_content:
                    return True
        
        # Fallback: Check content even if header is missing (some hide it)
        if any(flag in html_content for flag in cloudflare_flags):
            return True

    return False


def get_cloudflare_details(status_code: int, headers: dict, html_content: str) -> Dict[str, any]:
    """
    Get detailed information about Cloudflare protection if detected.
    
    This provides more context about why the protection was triggered,
    which can be useful for logging and debugging.
    
    Args:
        status_code: HTTP response status code
        headers: Dictionary of HTTP response headers
        html_content: The HTML content of the response body
        
    Returns:
        Dictionary with detection details including:
        - is_protected: Boolean indicating if protection is detected
        - status_code: The HTTP status code
        - server_header: The server header value if present
        - matched_flags: List of flags that matched in the content
        - ray_id: Cloudflare Ray ID if found
    """
    is_protected = has_cloudflare_protection(status_code, headers, html_content)
    
    server_header = headers.get('Server', '')
    
    cloudflare_flags = [
        '403 Forbidden',
        'cloudflare',
        'Security check',
        'Please Wait... | Cloudflare',
        'We are checking your browser...',
        'Checking your browser before accessing',
        'This process is automatic.',
        'DDoS protection by',
        'Ray ID:',
        '_cf_chl',
        'cf-spinner-please-wait'
    ]
    
    matched_flags = [flag for flag in cloudflare_flags if flag in html_content]
    
    # Try to extract Ray ID
    ray_id = None
    if 'Ray ID:' in html_content:
        try:
            start_idx = html_content.index('Ray ID:') + 8
            # Ray IDs are typically 16 hex characters
            ray_id = html_content[start_idx:start_idx + 20].strip().split('<')[0].strip()
        except (ValueError, IndexError):
            pass
    
    return {
        'is_protected': is_protected,
        'status_code': status_code,
        'server_header': server_header,
        'matched_flags': matched_flags,
        'ray_id': ray_id,
    }


def extract_page_metadata(html_content: str) -> Dict[str, Optional[str]]:
    """
    Extract basic metadata from HTML content.
    
    Useful for logging and understanding what page was actually loaded.
    
    Args:
        html_content: The HTML content of the response body
        
    Returns:
        Dictionary with:
        - title: Page title if found
        - charset: Character encoding if specified
    """
    metadata = {
        'title': None,
        'charset': None,
    }
    
    # Extract title
    title_start = html_content.lower().find('<title>')
    if title_start != -1:
        title_end = html_content.lower().find('</title>', title_start)
        if title_end != -1:
            metadata['title'] = html_content[title_start + 7:title_end].strip()
    
    # Extract charset
    charset_patterns = [
        'charset=',
        'encoding="',
        "encoding='",
    ]
    for pattern in charset_patterns:
        idx = html_content.lower().find(pattern)
        if idx != -1:
            start = idx + len(pattern)
            # Find the end of the charset value
            for end_char in ['"', "'", ';', ' ', '>']:
                end = html_content.find(end_char, start)
                if end != -1:
                    metadata['charset'] = html_content[start:end].strip()
                    break
            break
    
    return metadata


def is_captcha_page(html_content: str) -> bool:
    """
    Detect if the page is showing a CAPTCHA challenge.
    
    Args:
        html_content: The HTML content of the response body
        
    Returns:
        True if CAPTCHA indicators are found, False otherwise
    """
    captcha_indicators = [
        'captcha',
        'g-recaptcha',
        'h-captcha',
        'hcaptcha',
        'cf-turnstile',
        'recaptcha',
        'verify you are human',
        'prove you are human',
        'human verification',
        'bot detection',
        'security challenge',
    ]
    
    html_lower = html_content.lower()
    return any(indicator in html_lower for indicator in captcha_indicators)


def is_rate_limited(status_code: int, headers: dict, html_content: str) -> bool:
    """
    Detect if the response indicates rate limiting.
    
    Args:
        status_code: HTTP response status code
        headers: Dictionary of HTTP response headers
        html_content: The HTML content of the response body
        
    Returns:
        True if rate limiting is detected, False otherwise
    """
    # Check status code
    if status_code == 429:
        return True
    
    # Check headers
    rate_limit_headers = [
        'X-RateLimit-Remaining',
        'X-Rate-Limit-Remaining',
        'RateLimit-Remaining',
        'Retry-After',
    ]
    
    for header in rate_limit_headers:
        value = headers.get(header)
        if value is not None:
            # If remaining is 0, we're rate limited
            if header.lower().endswith('remaining'):
                try:
                    if int(value) == 0:
                        return True
                except ValueError:
                    pass
            # If Retry-After is present, we're likely rate limited
            elif header == 'Retry-After':
                return True
    
    # Check content
    rate_limit_indicators = [
        'rate limit',
        'too many requests',
        'slow down',
        'try again later',
        'request limit exceeded',
    ]
    
    html_lower = html_content.lower()
    return any(indicator in html_lower for indicator in rate_limit_indicators)


def check_page_accessibility(
    status_code: int, 
    headers: dict, 
    html_content: str
) -> Tuple[bool, str]:
    """
    Comprehensive check for page accessibility.
    
    This is the main function to call after every page load to determine
    if the content is actually visible or if there's a blocking issue.
    
    Args:
        status_code: HTTP response status code
        headers: Dictionary of HTTP response headers
        html_content: The HTML content of the response body
        
    Returns:
        Tuple of (is_accessible, reason):
        - is_accessible: True if page content should be visible
        - reason: Human-readable reason if not accessible
    """
    # Check for Cloudflare protection
    if has_cloudflare_protection(status_code, headers, html_content):
        return False, "Cloudflare protection detected"
    
    # Check for CAPTCHA
    if is_captcha_page(html_content):
        return False, "CAPTCHA challenge detected"
    
    # Check for rate limiting
    if is_rate_limited(status_code, headers, html_content):
        return False, "Rate limiting detected"
    
    # Check for general HTTP errors
    if status_code >= 400:
        return False, f"HTTP error: {status_code}"
    
    # Check for empty content
    if not html_content or len(html_content.strip()) < 100:
        return False, "Empty or minimal page content"
    
    return True, "Page is accessible"
