# GitHub Copilot Configuration

This directory contains configuration files for GitHub Copilot coding agent to work effectively with the Schichtplan codebase.

## Files Overview

### `copilot-instructions.md`
Main instructions file that Copilot reads to understand:
- Project structure and architecture
- Development workflows and commands
- Coding standards and patterns
- Critical constraints and gotchas
- Debugging procedures

This file is comprehensive (329 lines) and covers all aspects of the project.

### `copilot-setup-steps.yaml`
Automated setup steps that Copilot coding agent uses to:
- Set up Python virtual environment
- Install dependencies (Python + Bun)
- Initialize database
- Run quality checks (linting, type checking)
- Execute test suites
- Build verification

Copilot will run these steps when starting work on the repository to ensure proper environment configuration.

### `instructions/` Directory
Path-specific instructions that apply when working with particular areas of the codebase:

- **`scheduler.instructions.md`** - Guidelines for backend scheduler module
  - Interval-based coverage logic
  - Keyholder constraints
  - Performance patterns
  - Debugging resources

- **`frontend-components.instructions.md`** - Frontend component development
  - Design system patterns
  - Type safety rules
  - API integration
  - AI component guidelines

- **`database-migrations.instructions.md`** - Database migration best practices
  - Migration workflows
  - Common patterns
  - Testing procedures
  - Emergency handling

### `agents/` Directory
Custom agent configurations for specialized tasks:

- **`mcp-integration.agent.md`** - MCP and AI integration specialist
  - MCP tool development
  - Conversational AI patterns
  - Streaming responses
  - Background tasks

## How Copilot Uses These Files

When GitHub Copilot coding agent works on this repository:

1. **Repository-wide context**: Reads `copilot-instructions.md` for general guidance
2. **Setup automation**: Executes steps from `copilot-setup-steps.yaml` to configure environment
3. **Path-specific guidance**: When working in specific directories, applies relevant instructions from `instructions/`
4. **Specialized tasks**: Can invoke custom agents from `agents/` for domain-specific work

## Best Practices Followed

This configuration follows [GitHub's best practices for Copilot coding agent](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results):

✅ Clear, concise repository-wide instructions  
✅ Automated environment setup steps  
✅ Path-specific instructions for specialized areas  
✅ Custom agents for domain expertise  
✅ Comprehensive documentation references  
✅ Common pitfalls and debugging guidance  

## Maintaining These Files

### When to Update

**`copilot-instructions.md`**:
- When project structure changes significantly
- When new major features are added
- When development workflows change
- When new constraints or gotchas are discovered

**`copilot-setup-steps.yaml`**:
- When dependencies are added/removed
- When build process changes
- When new quality checks are introduced
- When database setup procedures change

**Path-specific instructions**:
- When module architecture evolves
- When new patterns are established
- When common mistakes are identified
- When debugging procedures change

**Agent configurations**:
- When new specialized workflows emerge
- When integration patterns change
- When new tools are added

### Update Checklist

When making significant changes:

- [ ] Update relevant instruction files
- [ ] Test instructions with Copilot coding agent
- [ ] Ensure consistency across all files
- [ ] Update cross-references between files
- [ ] Verify YAML syntax is valid
- [ ] Document the changes

## Testing Instructions

To verify these instructions work well:

1. **Assign a well-scoped issue to Copilot**:
   ```
   Issue: Add a new field to the Employee model
   Acceptance criteria:
   - Add 'department' field to Employee model
   - Create and apply migration
   - Update API endpoints
   - Add tests
   ```

2. **Review Copilot's approach**:
   - Does it follow the documented patterns?
   - Does it use the correct tools and commands?
   - Does it avoid documented pitfalls?

3. **Iterate on instructions**:
   - If Copilot makes mistakes, clarify instructions
   - Add new sections for recurring issues
   - Remove outdated guidance

## Resources

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Best Practices for Copilot Coding Agent](https://docs.github.com/en/copilot/tutorials/coding-agent/get-the-best-results)
- [Piloting Copilot in Organizations](https://docs.github.com/en/copilot/tutorials/coding-agent/pilot-coding-agent)
- [Custom Instructions Guide](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)

## Questions or Improvements?

If you notice:
- Copilot consistently misunderstanding something
- Instructions that are unclear or contradictory
- Missing guidance for common tasks
- Outdated information

Please update the relevant files or open an issue to discuss improvements.

---

**Last Updated**: January 10, 2025  
**Maintained By**: Project maintainers
