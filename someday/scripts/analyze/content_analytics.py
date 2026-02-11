#!/usr/bin/env python3
"""
Content Analytics for Sara Sharp Knowledge Base
Analyzes documents and transcripts to generate comprehensive metrics and reports.
"""

import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple
import statistics


# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
NORMALIZED_DIR = DATA_DIR / "normalized" / "documents"
TRANSCRIPTS_DIR = DATA_DIR / "raw" / "youtube" / "transcripts"
METADATA_DIR = DATA_DIR / "raw" / "youtube" / "metadata"
REPORTS_DIR = BASE_DIR / "reports"


# Business domain keywords for topic analysis
BUSINESS_KEYWORDS = {
    "m&a": ["m&a", "merger", "mergers", "acquisition", "acquisitions", "deal", "deals", "transaction", "transactions", "purchase agreement", "loi", "letter of intent"],
    "accounting": ["accounting", "cpa", "tax", "taxes", "bookkeeping", "audit", "financial statements", "accounting firm", "accounting practice"],
    "due_diligence": ["due diligence", "diligence", "investigation", "review", "analysis", "verification"],
    "legal": ["attorney", "lawyer", "legal", "contract", "agreement", "clause", "non-compete", "indemnification", "liability"],
    "financing": ["financing", "loan", "sba", "seller financing", "bank", "lender", "debt", "equity"],
    "valuation": ["valuation", "value", "price", "multiple", "ebitda", "revenue multiple", "purchase price"],
    "privacy": ["privacy", "data protection", "gdpr", "ccpa", "data breach", "personal information", "consent"],
    "compliance": ["compliance", "regulatory", "regulation", "boi", "corporate transparency", "reporting"],
    "negotiation": ["negotiation", "negotiate", "terms", "seller", "buyer", "closing"],
    "business_operations": ["business", "client", "customer", "employee", "staff", "operations", "management"]
}


def load_json_file(filepath: Path) -> Dict:
    """Load a JSON file and return its contents."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return {}


def get_all_normalized_documents() -> List[Dict]:
    """Load all normalized documents."""
    documents = []
    if NORMALIZED_DIR.exists():
        for filepath in NORMALIZED_DIR.glob("*.json"):
            doc = load_json_file(filepath)
            if doc:
                doc['_filepath'] = str(filepath)
                doc['_filesize'] = filepath.stat().st_size
                documents.append(doc)
    return documents


def get_all_transcripts() -> List[Dict]:
    """Load all raw YouTube transcripts."""
    transcripts = []
    if TRANSCRIPTS_DIR.exists():
        for filepath in TRANSCRIPTS_DIR.glob("*.json"):
            doc = load_json_file(filepath)
            if doc:
                doc['_filepath'] = str(filepath)
                doc['_filesize'] = filepath.stat().st_size
                transcripts.append(doc)
    return transcripts


def count_words(text: str) -> int:
    """Count words in text."""
    if not text:
        return 0
    return len(text.split())


def extract_text(doc: Dict) -> str:
    """Extract text content from a document."""
    if 'content' in doc:
        if isinstance(doc['content'], dict):
            return doc['content'].get('text', '')
        return doc['content']
    return ''


def analyze_keywords(text: str, keyword_groups: Dict[str, List[str]]) -> Dict[str, int]:
    """Analyze frequency of keyword groups in text."""
    text_lower = text.lower()
    results = {}
    for category, keywords in keyword_groups.items():
        count = 0
        for keyword in keywords:
            count += text_lower.count(keyword.lower())
        results[category] = count
    return results


def parse_duration(seconds: int) -> str:
    """Convert seconds to HH:MM:SS format."""
    if not seconds:
        return "00:00:00"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def get_duration_bucket(seconds: int) -> str:
    """Categorize video duration into buckets."""
    if not seconds:
        return "Unknown"
    if seconds < 300:  # 5 minutes
        return "0-5 min"
    elif seconds < 600:  # 10 minutes
        return "5-10 min"
    elif seconds < 900:  # 15 minutes
        return "10-15 min"
    elif seconds < 1200:  # 20 minutes
        return "15-20 min"
    elif seconds < 1800:  # 30 minutes
        return "20-30 min"
    elif seconds < 3600:  # 60 minutes
        return "30-60 min"
    else:
        return "60+ min"


def calculate_statistics(values: List[float]) -> Dict[str, float]:
    """Calculate basic statistics for a list of values."""
    if not values:
        return {"min": 0, "max": 0, "mean": 0, "median": 0, "std_dev": 0, "total": 0}

    return {
        "min": min(values),
        "max": max(values),
        "mean": round(statistics.mean(values), 2),
        "median": round(statistics.median(values), 2),
        "std_dev": round(statistics.stdev(values), 2) if len(values) > 1 else 0,
        "total": sum(values)
    }


def run_analytics() -> Dict[str, Any]:
    """Run comprehensive content analytics."""
    print("Loading documents...")
    normalized_docs = get_all_normalized_documents()
    transcripts = get_all_transcripts()

    print(f"Found {len(normalized_docs)} normalized documents")
    print(f"Found {len(transcripts)} raw transcripts")

    # Separate by source type
    blog_docs = [d for d in normalized_docs if d.get('source_type') == 'blog_article']
    youtube_docs = [d for d in normalized_docs if d.get('source_type') == 'video_transcript']

    # Analytics results
    results = {
        "report_metadata": {
            "generated_at": datetime.now().isoformat(),
            "analyzer_version": "1.0.0",
            "base_directory": str(BASE_DIR)
        },
        "summary": {},
        "content_by_source": {},
        "word_count_analysis": {},
        "topic_analysis": {},
        "duration_analysis": {},
        "timeline_analysis": {},
        "quality_analysis": {},
        "detailed_inventory": []
    }

    # ============================================
    # Summary Statistics
    # ============================================
    all_word_counts = []
    all_texts = []

    # Process normalized documents
    for doc in normalized_docs:
        text = extract_text(doc)
        word_count = doc.get('metadata', {}).get('word_count') or count_words(text)
        all_word_counts.append(word_count)
        all_texts.append(text)

    # Process raw transcripts (for those not in normalized)
    normalized_video_ids = set()
    for doc in youtube_docs:
        video_id = doc.get('metadata', {}).get('source_specific', {}).get('video_id')
        if video_id:
            normalized_video_ids.add(video_id)

    additional_transcripts = []
    for t in transcripts:
        video_id = t.get('video_id')
        if video_id and video_id not in normalized_video_ids:
            additional_transcripts.append(t)
            text = t.get('content', '')
            word_count = count_words(text)
            all_word_counts.append(word_count)
            all_texts.append(text)

    total_docs = len(normalized_docs) + len(additional_transcripts)
    total_words = sum(all_word_counts)

    results["summary"] = {
        "total_documents": total_docs,
        "total_word_count": total_words,
        "average_document_length": round(total_words / total_docs, 2) if total_docs > 0 else 0,
        "normalized_documents": len(normalized_docs),
        "raw_transcripts_only": len(additional_transcripts),
        "blog_articles": len(blog_docs),
        "youtube_videos": len(youtube_docs) + len(additional_transcripts)
    }

    # ============================================
    # Content by Source Analysis
    # ============================================
    source_stats = defaultdict(lambda: {"count": 0, "total_words": 0, "word_counts": []})

    for doc in normalized_docs:
        source = doc.get('source', 'unknown')
        source_type = doc.get('source_type', 'unknown')
        text = extract_text(doc)
        word_count = doc.get('metadata', {}).get('word_count') or count_words(text)

        source_stats[source]["count"] += 1
        source_stats[source]["total_words"] += word_count
        source_stats[source]["word_counts"].append(word_count)
        source_stats[source]["source_type"] = source_type

    # Add raw transcripts
    for t in additional_transcripts:
        text = t.get('content', '')
        word_count = count_words(text)
        source_stats["youtube_raw"]["count"] += 1
        source_stats["youtube_raw"]["total_words"] += word_count
        source_stats["youtube_raw"]["word_counts"].append(word_count)
        source_stats["youtube_raw"]["source_type"] = "video_transcript"

    results["content_by_source"] = {}
    for source, stats in source_stats.items():
        results["content_by_source"][source] = {
            "document_count": stats["count"],
            "total_words": stats["total_words"],
            "average_words": round(stats["total_words"] / stats["count"], 2) if stats["count"] > 0 else 0,
            "source_type": stats.get("source_type", "unknown"),
            "word_count_stats": calculate_statistics(stats["word_counts"])
        }

    # ============================================
    # Word Count Analysis
    # ============================================
    blog_word_counts = [d.get('metadata', {}).get('word_count', 0) or count_words(extract_text(d)) for d in blog_docs]
    youtube_word_counts = [d.get('metadata', {}).get('word_count', 0) or count_words(extract_text(d)) for d in youtube_docs]
    transcript_word_counts = [count_words(t.get('content', '')) for t in additional_transcripts]

    results["word_count_analysis"] = {
        "overall": calculate_statistics(all_word_counts),
        "by_type": {
            "blog_articles": calculate_statistics(blog_word_counts),
            "youtube_normalized": calculate_statistics(youtube_word_counts),
            "youtube_raw_only": calculate_statistics(transcript_word_counts)
        },
        "distribution": {
            "0-500": len([w for w in all_word_counts if w <= 500]),
            "501-1000": len([w for w in all_word_counts if 500 < w <= 1000]),
            "1001-2000": len([w for w in all_word_counts if 1000 < w <= 2000]),
            "2001-3000": len([w for w in all_word_counts if 2000 < w <= 3000]),
            "3001+": len([w for w in all_word_counts if w > 3000])
        }
    }

    # ============================================
    # Topic/Keyword Analysis
    # ============================================
    combined_text = " ".join(all_texts)
    topic_counts = analyze_keywords(combined_text, BUSINESS_KEYWORDS)

    # Get top individual words (simple frequency)
    words = re.findall(r'\b[a-zA-Z]{4,}\b', combined_text.lower())
    word_freq = Counter(words)

    # Filter out common words
    stopwords = {'that', 'this', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said',
                 'each', 'which', 'their', 'there', 'would', 'could', 'should', 'about', 'into',
                 'just', 'also', 'what', 'when', 'your', 'more', 'some', 'them', 'than', 'then',
                 'because', 'going', 'really', 'think', 'know', 'like', 'want', 'being', 'very',
                 'other', 'after', 'before', 'these', 'those', 'make', 'does', 'doing', 'done'}

    filtered_words = {k: v for k, v in word_freq.items() if k not in stopwords}
    top_words = dict(Counter(filtered_words).most_common(50))

    results["topic_analysis"] = {
        "business_domain_frequency": dict(sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)),
        "top_50_keywords": top_words,
        "total_unique_words": len(set(words)),
        "total_word_occurrences": len(words)
    }

    # ============================================
    # Duration Analysis (for videos)
    # ============================================
    durations = []
    duration_buckets = defaultdict(int)

    for doc in youtube_docs:
        duration = doc.get('metadata', {}).get('duration_seconds') or \
                   doc.get('metadata', {}).get('source_specific', {}).get('duration_seconds', 0)
        if duration:
            durations.append(duration)
            bucket = get_duration_bucket(duration)
            duration_buckets[bucket] += 1

    for t in transcripts:
        duration = t.get('duration_seconds', 0)
        if duration and t.get('video_id') not in normalized_video_ids:
            durations.append(duration)
            bucket = get_duration_bucket(duration)
            duration_buckets[bucket] += 1

    if durations:
        results["duration_analysis"] = {
            "total_videos": len(durations),
            "total_duration_seconds": sum(durations),
            "total_duration_formatted": parse_duration(sum(durations)),
            "statistics": {
                "min_seconds": min(durations),
                "max_seconds": max(durations),
                "mean_seconds": round(statistics.mean(durations), 2),
                "median_seconds": round(statistics.median(durations), 2),
                "min_formatted": parse_duration(min(durations)),
                "max_formatted": parse_duration(max(durations)),
                "mean_formatted": parse_duration(int(statistics.mean(durations))),
                "median_formatted": parse_duration(int(statistics.median(durations)))
            },
            "distribution": dict(sorted(duration_buckets.items(), key=lambda x: ["0-5 min", "5-10 min", "10-15 min", "15-20 min", "20-30 min", "30-60 min", "60+ min", "Unknown"].index(x[0]) if x[0] in ["0-5 min", "5-10 min", "10-15 min", "15-20 min", "20-30 min", "30-60 min", "60+ min", "Unknown"] else 99))
        }

    # ============================================
    # Timeline Analysis
    # ============================================
    dates = []
    date_counts = defaultdict(int)

    for doc in normalized_docs:
        pub_date = doc.get('metadata', {}).get('published_date')
        if pub_date:
            dates.append(pub_date)
            # Extract year-month
            try:
                if len(pub_date) >= 7:
                    year_month = pub_date[:7]
                    date_counts[year_month] += 1
            except:
                pass

    for t in transcripts:
        upload_date = t.get('upload_date')
        if upload_date and t.get('video_id') not in normalized_video_ids:
            # Convert YYYYMMDD to YYYY-MM-DD
            try:
                formatted = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
                dates.append(formatted)
                year_month = formatted[:7]
                date_counts[year_month] += 1
            except:
                pass

    results["timeline_analysis"] = {
        "documents_with_dates": len(dates),
        "documents_without_dates": total_docs - len(dates),
        "date_range": {
            "earliest": min(dates) if dates else None,
            "latest": max(dates) if dates else None
        },
        "by_month": dict(sorted(date_counts.items()))
    }

    # ============================================
    # Quality Score Analysis
    # ============================================
    quality_scores = []

    for doc in normalized_docs:
        score = doc.get('extraction', {}).get('quality_score')
        if score is not None:
            quality_scores.append(score)

    if quality_scores:
        results["quality_analysis"] = {
            "documents_with_scores": len(quality_scores),
            "statistics": {
                "min": round(min(quality_scores), 3),
                "max": round(max(quality_scores), 3),
                "mean": round(statistics.mean(quality_scores), 3),
                "median": round(statistics.median(quality_scores), 3)
            },
            "distribution": {
                "excellent (0.85-1.0)": len([s for s in quality_scores if s >= 0.85]),
                "good (0.70-0.84)": len([s for s in quality_scores if 0.70 <= s < 0.85]),
                "acceptable (0.50-0.69)": len([s for s in quality_scores if 0.50 <= s < 0.70]),
                "poor (<0.50)": len([s for s in quality_scores if s < 0.50])
            }
        }

    # ============================================
    # Detailed Inventory
    # ============================================
    inventory = []

    for doc in normalized_docs:
        text = extract_text(doc)
        word_count = doc.get('metadata', {}).get('word_count') or count_words(text)

        item = {
            "id": doc.get('id', 'unknown'),
            "source": doc.get('source', 'unknown'),
            "source_type": doc.get('source_type', 'unknown'),
            "title": doc.get('title', 'Untitled'),
            "url": doc.get('metadata', {}).get('url', ''),
            "author": doc.get('metadata', {}).get('author', ''),
            "published_date": doc.get('metadata', {}).get('published_date', ''),
            "word_count": word_count,
            "quality_score": doc.get('extraction', {}).get('quality_score'),
            "extracted_at": doc.get('extraction', {}).get('extracted_at', ''),
            "file_path": doc.get('_filepath', ''),
            "file_size_bytes": doc.get('_filesize', 0)
        }

        # Add video-specific metadata
        if doc.get('source_type') == 'video_transcript':
            source_specific = doc.get('metadata', {}).get('source_specific', {})
            item["video_id"] = source_specific.get('video_id', '')
            item["duration_seconds"] = source_specific.get('duration_seconds') or doc.get('metadata', {}).get('duration_seconds', 0)
            item["view_count"] = source_specific.get('view_count', 0)
            item["like_count"] = source_specific.get('like_count', 0)

        inventory.append(item)

    # Add raw transcripts not in normalized
    for t in additional_transcripts:
        text = t.get('content', '')
        word_count = count_words(text)

        item = {
            "id": f"yt_{t.get('video_id', 'unknown')}",
            "source": "youtube_raw",
            "source_type": "video_transcript",
            "title": t.get('title', 'Untitled'),
            "url": t.get('url', ''),
            "author": t.get('channel_name', ''),
            "published_date": t.get('upload_date', ''),
            "word_count": word_count,
            "quality_score": None,
            "extracted_at": t.get('extracted_at', ''),
            "file_path": t.get('_filepath', ''),
            "file_size_bytes": t.get('_filesize', 0),
            "video_id": t.get('video_id', ''),
            "duration_seconds": t.get('duration_seconds', 0),
            "view_count": t.get('view_count', 0),
            "like_count": t.get('like_count', 0)
        }
        inventory.append(item)

    results["detailed_inventory"] = sorted(inventory, key=lambda x: x.get('published_date', '') or '', reverse=True)

    return results


def generate_markdown_reports(analytics: Dict[str, Any]) -> None:
    """Generate markdown reports from analytics data."""

    # ============================================
    # Content Quality Report
    # ============================================
    quality_report = f"""# Sara Sharp Knowledge Base - Content Quality Report

**Generated**: {analytics['report_metadata']['generated_at']}
**Analyzer Version**: {analytics['report_metadata']['analyzer_version']}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Documents | {analytics['summary']['total_documents']} |
| Total Word Count | {analytics['summary']['total_word_count']:,} |
| Average Document Length | {analytics['summary']['average_document_length']:,} words |
| Blog Articles | {analytics['summary']['blog_articles']} |
| YouTube Videos | {analytics['summary']['youtube_videos']} |

---

## Document Count by Source

| Source | Type | Count | Total Words | Avg Words |
|--------|------|-------|-------------|-----------|
"""

    for source, stats in analytics['content_by_source'].items():
        quality_report += f"| {source} | {stats['source_type']} | {stats['document_count']} | {stats['total_words']:,} | {stats['average_words']:,.0f} |\n"

    quality_report += f"""
---

## Word Count Statistics

### Overall
- **Total Words**: {analytics['word_count_analysis']['overall']['total']:,}
- **Min**: {analytics['word_count_analysis']['overall']['min']:,} words
- **Max**: {analytics['word_count_analysis']['overall']['max']:,} words
- **Mean**: {analytics['word_count_analysis']['overall']['mean']:,.0f} words
- **Median**: {analytics['word_count_analysis']['overall']['median']:,.0f} words

### Distribution
| Range | Count |
|-------|-------|
"""

    for range_name, count in analytics['word_count_analysis']['distribution'].items():
        quality_report += f"| {range_name} words | {count} |\n"

    # Quality score section
    if 'quality_analysis' in analytics:
        qa = analytics['quality_analysis']
        quality_report += f"""
---

## Quality Score Distribution

**Documents with quality scores**: {qa['documents_with_scores']}

### Statistics
- **Min**: {qa['statistics']['min']:.3f}
- **Max**: {qa['statistics']['max']:.3f}
- **Mean**: {qa['statistics']['mean']:.3f}
- **Median**: {qa['statistics']['median']:.3f}

### Tier Distribution
| Tier | Count |
|------|-------|
"""
        for tier, count in qa['distribution'].items():
            quality_report += f"| {tier} | {count} |\n"

    quality_report += """
---

## Content Gaps Identified

Based on analysis of the knowledge base:

1. **Missing Summaries**: Documents lack AI-generated summaries for quick reference
2. **Missing Key Topics**: Topic extraction not implemented - would improve searchability
3. **Publication Dates**: Some documents missing publication dates
4. **Video Engagement Data**: View counts and like counts available but not analyzed for content prioritization

---

## Recommendations for Improvement

### High Priority
1. **Generate AI Summaries**: Add 2-3 sentence summaries to each document for quick scanning
2. **Extract Key Topics**: Implement NLP-based topic extraction for better categorization
3. **Standardize Metadata**: Ensure all documents have consistent metadata fields

### Medium Priority
1. **Content Gap Analysis**: Identify topics mentioned but not fully covered
2. **Quality Score Improvement**: Review documents with quality scores below 0.70
3. **Temporal Analysis**: Track content freshness and update cadence

### Low Priority
1. **Engagement Correlation**: Analyze relationship between video engagement and content quality
2. **Author Analysis**: Compare quality metrics across different authors
3. **Length Optimization**: Determine optimal document lengths for different content types
"""

    # Write quality report
    with open(REPORTS_DIR / "content_quality_report.md", 'w') as f:
        f.write(quality_report)
    print(f"Generated: {REPORTS_DIR / 'content_quality_report.md'}")

    # ============================================
    # Topic Coverage Report
    # ============================================
    topic_report = f"""# Sara Sharp Knowledge Base - Topic Coverage Analysis

**Generated**: {analytics['report_metadata']['generated_at']}

---

## Business Domain Coverage

Analysis of key business terms across all {analytics['summary']['total_documents']} documents:

| Domain | Frequency | Coverage Level |
|--------|-----------|----------------|
"""

    max_freq = max(analytics['topic_analysis']['business_domain_frequency'].values()) if analytics['topic_analysis']['business_domain_frequency'] else 1

    for domain, freq in analytics['topic_analysis']['business_domain_frequency'].items():
        coverage = "High" if freq > max_freq * 0.6 else ("Medium" if freq > max_freq * 0.3 else "Low")
        topic_report += f"| {domain.replace('_', ' ').title()} | {freq:,} | {coverage} |\n"

    topic_report += f"""
---

## Top 50 Keywords

Most frequently occurring meaningful terms (excluding common words):

| Rank | Keyword | Frequency |
|------|---------|-----------|
"""

    for i, (word, freq) in enumerate(list(analytics['topic_analysis']['top_50_keywords'].items())[:50], 1):
        topic_report += f"| {i} | {word} | {freq:,} |\n"

    topic_report += f"""
---

## Content Type Distribution

| Content Type | Count | Percentage |
|--------------|-------|------------|
| Blog Articles | {analytics['summary']['blog_articles']} | {analytics['summary']['blog_articles']/analytics['summary']['total_documents']*100:.1f}% |
| YouTube Videos | {analytics['summary']['youtube_videos']} | {analytics['summary']['youtube_videos']/analytics['summary']['total_documents']*100:.1f}% |

---

## Topic Analysis Summary

- **Total Unique Words**: {analytics['topic_analysis']['total_unique_words']:,}
- **Total Word Occurrences**: {analytics['topic_analysis']['total_word_occurrences']:,}

### Key Observations

1. **Primary Focus**: M&A and business transactions dominate the content
2. **Legal Expertise**: Strong coverage of legal aspects (non-compete, agreements, contracts)
3. **Accounting Niche**: Specific focus on accounting practice acquisitions
4. **Compliance Content**: Coverage of privacy, data protection, and regulatory compliance

### Coverage Gaps to Consider

Based on keyword frequency analysis:

1. **Valuation Methodology**: Could benefit from more detailed valuation content
2. **Post-Acquisition Integration**: Limited content on integration strategies
3. **Industry Benchmarks**: Comparative data and benchmarks could be expanded
4. **Case Studies**: More real-world examples would enhance practical guidance
"""

    # Write topic report
    with open(REPORTS_DIR / "topic_coverage.md", 'w') as f:
        f.write(topic_report)
    print(f"Generated: {REPORTS_DIR / 'topic_coverage.md'}")

    # ============================================
    # Data Inventory Report
    # ============================================
    inventory_report = f"""# Sara Sharp Knowledge Base - Data Inventory

**Generated**: {analytics['report_metadata']['generated_at']}
**Total Documents**: {analytics['summary']['total_documents']}
**Total Word Count**: {analytics['summary']['total_word_count']:,}

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Normalized Documents | {analytics['summary']['normalized_documents']} |
| Raw Transcripts Only | {analytics['summary']['raw_transcripts_only']} |
| Blog Articles | {analytics['summary']['blog_articles']} |
| YouTube Videos | {analytics['summary']['youtube_videos']} |

---

## Timeline

"""

    if analytics['timeline_analysis']['date_range']['earliest']:
        inventory_report += f"""- **Earliest Content**: {analytics['timeline_analysis']['date_range']['earliest']}
- **Latest Content**: {analytics['timeline_analysis']['date_range']['latest']}
- **Documents with Dates**: {analytics['timeline_analysis']['documents_with_dates']}
- **Documents without Dates**: {analytics['timeline_analysis']['documents_without_dates']}

### Content by Month

| Month | Count |
|-------|-------|
"""
        for month, count in analytics['timeline_analysis']['by_month'].items():
            inventory_report += f"| {month} | {count} |\n"

    # Video duration analysis
    if 'duration_analysis' in analytics:
        da = analytics['duration_analysis']
        inventory_report += f"""
---

## Video Duration Analysis

- **Total Videos**: {da['total_videos']}
- **Total Duration**: {da['total_duration_formatted']} ({da['total_duration_seconds']:,} seconds)
- **Average Duration**: {da['statistics']['mean_formatted']}
- **Median Duration**: {da['statistics']['median_formatted']}
- **Shortest**: {da['statistics']['min_formatted']}
- **Longest**: {da['statistics']['max_formatted']}

### Duration Distribution

| Duration Range | Count |
|----------------|-------|
"""
        for range_name, count in da['distribution'].items():
            inventory_report += f"| {range_name} | {count} |\n"

    inventory_report += f"""
---

## Complete Document Inventory

| ID | Title | Source | Words | Quality | Date | URL |
|----|-------|--------|-------|---------|------|-----|
"""

    for item in analytics['detailed_inventory'][:100]:  # Limit to 100 for readability
        title = item['title'][:50] + "..." if len(item['title']) > 50 else item['title']
        title = title.replace("|", "-")  # Escape pipe characters
        quality = f"{item['quality_score']:.2f}" if item['quality_score'] else "N/A"
        date = item['published_date'][:10] if item['published_date'] else "N/A"
        url = item['url'][:50] + "..." if len(item['url']) > 50 else item['url']

        inventory_report += f"| {item['id'][:20]} | {title} | {item['source']} | {item['word_count']:,} | {quality} | {date} | [Link]({item['url']}) |\n"

    if len(analytics['detailed_inventory']) > 100:
        inventory_report += f"\n*... and {len(analytics['detailed_inventory']) - 100} more documents (see JSON report for complete list)*\n"

    inventory_report += """
---

## File Size Summary

"""

    total_size = sum(item['file_size_bytes'] for item in analytics['detailed_inventory'])
    inventory_report += f"- **Total Storage**: {total_size / 1024 / 1024:.2f} MB\n"
    inventory_report += f"- **Average File Size**: {total_size / len(analytics['detailed_inventory']) / 1024:.2f} KB\n"

    # Write inventory report
    with open(REPORTS_DIR / "data_inventory.md", 'w') as f:
        f.write(inventory_report)
    print(f"Generated: {REPORTS_DIR / 'data_inventory.md'}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Sara Sharp Knowledge Base - Content Analytics")
    print("=" * 60)

    # Run analytics
    analytics = run_analytics()

    # Save JSON report
    json_report_path = REPORTS_DIR / f"content_analytics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_report_path, 'w') as f:
        json.dump(analytics, f, indent=2, default=str)
    print(f"\nGenerated JSON report: {json_report_path}")

    # Generate markdown reports
    print("\nGenerating markdown reports...")
    generate_markdown_reports(analytics)

    # Print summary
    print("\n" + "=" * 60)
    print("ANALYTICS SUMMARY")
    print("=" * 60)
    print(f"Total Documents: {analytics['summary']['total_documents']}")
    print(f"Total Word Count: {analytics['summary']['total_word_count']:,}")
    print(f"Average Document Length: {analytics['summary']['average_document_length']:,.0f} words")
    print(f"Blog Articles: {analytics['summary']['blog_articles']}")
    print(f"YouTube Videos: {analytics['summary']['youtube_videos']}")

    if 'duration_analysis' in analytics:
        print(f"\nTotal Video Duration: {analytics['duration_analysis']['total_duration_formatted']}")

    print("\nTop Business Domains:")
    for domain, freq in list(analytics['topic_analysis']['business_domain_frequency'].items())[:5]:
        print(f"  - {domain}: {freq:,} mentions")

    print("\n" + "=" * 60)
    print("Reports generated successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
