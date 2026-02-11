import os
import datetime

def get_all_files(directory):
    """Get all relevant files from the analyzer directory"""
    files = []
    extensions = ('.py', '.yaml', '.csv', '.html', '.css', '.js', '.txt', '.md')
    
    for root, dirs, filenames in os.walk(directory):
        # Skip __pycache__ and other cache directories
        dirs[:] = [d for d in dirs if not d.startswith('__') and d != '.git']
        
        for filename in filenames:
            if filename.endswith(extensions):
                filepath = os.path.join(root, filename)
                files.append(filepath)
    
    return sorted(files)

def read_file_content(filepath):
    """Read file content with proper encoding handling"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                return f.read()
        except:
            return "[ERROR: Could not read file]"

def create_comprehensive_file():
    """Create a comprehensive file with all analyzer code"""
    output_file = "ANALYZER_COMPLETE_CODEBASE.txt"
    
    with open(output_file, 'w', encoding='utf-8') as out:
        # Header
        out.write("="*80 + "\n")
        out.write("ANALYZER COMPLETE CODEBASE FOR INTEGRATION INTO EXITREADY\n")
        out.write("="*80 + "\n\n")
        out.write(f"Generated on: {datetime.datetime.now()}\n")
        out.write("This file contains the entire analyzer codebase organized for integration.\n")
        out.write("Each file is clearly marked with separators for easy extraction.\n\n")
        
        # Get all files
        files = get_all_files('analyzer')
        
        # Write table of contents
        out.write("TABLE OF CONTENTS:\n")
        out.write("-"*80 + "\n")
        for i, filepath in enumerate(files, 1):
            relative_path = os.path.relpath(filepath, 'analyzer')
            out.write(f"{i:3d}. {relative_path}\n")
        
        out.write("\n" + "="*80 + "\n")
        out.write("FILE CONTENTS:\n")
        out.write("="*80 + "\n\n")
        
        # Write each file's content
        for filepath in files:
            relative_path = os.path.relpath(filepath, 'analyzer')
            
            out.write("="*80 + "\n")
            out.write(f"FILE: analyzer/{relative_path}\n")
            out.write("="*80 + "\n")
            
            content = read_file_content(filepath)
            out.write(content)
            
            if not content.endswith('\n'):
                out.write('\n')
            
            out.write("\n")
        
        # Footer
        out.write("="*80 + "\n")
        out.write("END OF ANALYZER CODEBASE\n")
        out.write("="*80 + "\n")
    
    print(f"Successfully created {output_file}")
    print(f"Total files included: {len(files)}")
    return output_file, len(files)

if __name__ == "__main__":
    output_file, num_files = create_comprehensive_file()
    print(f"\nThe complete analyzer codebase has been compiled into: {output_file}")
    print(f"This file contains {num_files} source files from the analyzer project.")
